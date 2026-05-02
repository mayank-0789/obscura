import { Connection } from "@solana/web3.js";
import { and, eq, gt, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db, budgets, transactions } from "@/lib/db";
import { apiOk } from "@/lib/api";
import { env } from "@/lib/env";
import { cronAuthGuard } from "@/lib/cron-auth";

// Schedule: every 5 minutes, fired by an external scheduler (Railway cron).

const MIN_AGE_SECONDS = 120;
const MAX_AGE_HOURS = 24;
const BATCH_LIMIT = 50;

interface PendingRow {
  id: string;
  agentId: string;
  amountUsdg: bigint;
  queueSignature: string | null;
}

export async function GET(req: Request): Promise<Response> {
  const guard = cronAuthGuard(req);
  if (guard) return guard;

  const connection = new Connection(env.HELIUS_RPC_URL, "confirmed");
  const startedAt = Date.now();

  const candidates = (await db
    .select({
      id: transactions.id,
      agentId: transactions.agentId,
      amountUsdg: transactions.amountUsdg,
      queueSignature: transactions.queueSignature,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.status, "pending"),
        eq(transactions.kind, "spend"),
        isNotNull(transactions.queueSignature),
        isNull(transactions.callbackSignature),
        lt(transactions.createdAt, sql`now() - interval '${sql.raw(`${MIN_AGE_SECONDS} seconds`)}'`),
        gt(transactions.createdAt, sql`now() - interval '${sql.raw(`${MAX_AGE_HOURS} hours`)}'`),
      ),
    )
    .limit(BATCH_LIMIT)) as PendingRow[];

  if (candidates.length === 0) {
    return apiOk({
      ok: true,
      processed: 0,
      confirmed: 0,
      failed: 0,
      skipped: 0,
      elapsedMs: Date.now() - startedAt,
    });
  }

  let confirmed = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of candidates) {
    if (!row.queueSignature) continue;
    let txInfo: Awaited<ReturnType<typeof connection.getTransaction>> = null;
    try {
      txInfo = await connection.getTransaction(row.queueSignature, {
        maxSupportedTransactionVersion: 0,
      });
    } catch (err) {
      console.warn(
        `[cron/reconcile] tx=${row.id} sig=${row.queueSignature.slice(0, 8)}… RPC failed:`,
        err instanceof Error ? err.message : err,
      );
      skipped += 1;
      continue;
    }

    if (!txInfo) {
      skipped += 1;
      continue;
    }

    if (txInfo.meta?.err) {
      // WHERE status='pending' on the atomic flip kills the two-reconciler double-revert race.
      const flipped = await db
        .update(transactions)
        .set({
          status: "failed",
          memo: sql`COALESCE(${transactions.memo}, 'reconciler: queue tx failed on chain')`,
        })
        .where(
          and(
            eq(transactions.id, row.id),
            eq(transactions.status, "pending"),
          ),
        )
        .returning({ id: transactions.id });

      if (flipped.length === 0) {
        skipped += 1;
        continue;
      }

      await db
        .update(budgets)
        .set({
          spentUsdg: sql`GREATEST(${budgets.spentUsdg} - ${row.amountUsdg}, 0)`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(budgets.agentId, row.agentId),
            eq(budgets.period, "monthly"),
          ),
        );
      console.log(
        `[cron/reconcile] tx=${row.id} sig=${row.queueSignature.slice(0, 8)}… failed → marked failed + cap reverted`,
      );
      failed += 1;
      continue;
    }

    await db
      .update(transactions)
      .set({
        status: "confirmed",
        confirmedAt: sql`now()`,
        callbackStatus: sql`COALESCE(${transactions.callbackStatus}, 'reconciled')`,
        solanaSig: sql`COALESCE(${transactions.solanaSig}, ${transactions.queueSignature})`,
      })
      .where(
        and(
          eq(transactions.id, row.id),
          eq(transactions.status, "pending"),
        ),
      );
    console.log(
      `[cron/reconcile] tx=${row.id} sig=${row.queueSignature.slice(0, 8)}… confirmed`,
    );
    confirmed += 1;
  }

  return apiOk({
    ok: true,
    processed: candidates.length,
    confirmed,
    failed,
    skipped,
    elapsedMs: Date.now() - startedAt,
  });
}
