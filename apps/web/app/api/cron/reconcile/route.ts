import { Connection } from "@solana/web3.js";
import { and, eq, gt, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db, budgets, transactions } from "@/lib/db";
import { apiOk } from "@/lib/api";
import { env } from "@/lib/env";
import { cronAuthGuard } from "@/lib/cron-auth";

// GET /api/cron/reconcile — auto-reconciler for x402 spends stuck pending.
//
// A spend lands in `pending` when its MPC callback didn't finalize within
// the SDK's monitor window (rare, but happens). The queue tx is on chain;
// the encrypted-balance deduction either landed (Arcium completed) or never
// will. We can't tell from inside the SDK once the monitor gave up — but we
// CAN inspect the queue tx via Solana RPC: if it succeeded, the deduction
// happened, mark confirmed; if it failed, mark failed and revert the cap.
//
// Schedule: every 5 minutes via Vercel Cron (see vercel.json). Idempotent —
// rows already confirmed/failed are skipped by the WHERE clause.
//
// Mirrors the logic in `scripts/umbra-reconcile-pending.ts`. The script form
// stays useful for manual ops (--dry-run, --max-age-hours flags); this route
// is the production loop.

const MIN_AGE_SECONDS = 120; // give the MPC a chance to land naturally first
const MAX_AGE_HOURS = 24; // older than this = manual intervention required
const BATCH_LIMIT = 50; // bound per-invocation work for Vercel's deadline

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

  // Pull pending spend rows that have a queue signature but no callback
  // signature yet, older than MIN_AGE_SECONDS and younger than MAX_AGE_HOURS.
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
    if (!row.queueSignature) continue; // belt-and-suspenders; SQL filtered already
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
      // Either dropped from the leader cache (try again next run) or never
      // landed. Be conservative: leave pending and let the next tick retry.
      skipped += 1;
      continue;
    }

    if (txInfo.meta?.err) {
      // Queue tx failed on chain — the deduction did NOT happen. We need
      // to (1) mark the row failed and (2) refund the cap counter, in that
      // order: the tx-mark UPDATE has `WHERE status = 'pending'` so two
      // concurrent reconciler runs can't both win the transition. The cap
      // revert only fires when the tx-mark actually flipped a row, killing
      // the theoretical "two reconcilers double-revert the same tx" race.
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
        // Another reconciler beat us to it. Skip — they handled the cap
        // revert. Counting this as `skipped` rather than `failed` so the
        // metric accurately reflects "I did the work for this row".
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

    // Queue tx landed successfully — Arcium accepted the deduction. Mark
    // the row confirmed. callbackStatus stays NULL (we never observed the
    // actual callback) so we set 'reconciled' as a marker.
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
