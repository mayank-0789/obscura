import "dotenv/config";
import { Connection } from "@solana/web3.js";
import { neon } from "@neondatabase/serverless";

// Reconciliation pass for transactions stuck in `status='pending'` after the
// MPC callback didn't finalize within the SDK monitor's timeout. Each row has
// a `queue_signature` (the Arcium MPC compute queue tx the SDK already
// submitted) but no `callback_signature` yet.
//
// What we do for each:
//   1. Look up the queue tx on Solana via the Helius RPC.
//   2. If the tx exists + succeeded, the deposit is committed on-chain. The
//      SDK's monitor just gave up early; on-chain truth says the deduction
//      landed, so flip the row to `confirmed`. (The encrypted-balance update
//      is the Arcium callback, but our success criterion for the spend is
//      that the queue tx resolved without error — Arcium will follow.)
//   3. If the tx is missing or failed, flip the row to `failed` and decrement
//      the agent's spent counter so the cap counter aligns with reality.
//
// Run from cron at ~5-minute cadence. Idempotent: rows already
// confirmed/failed are skipped.
//
// Usage:
//   pnpm exec tsx scripts/umbra-reconcile-pending.ts [--dry-run] [--max-age-hours=24]
//
// Env required:
//   - DATABASE_URL
//   - HELIUS_RPC_URL

interface PendingRow {
  id: string;
  agent_id: string;
  amount_usdg: string; // bigint as string from neon driver
  queue_signature: string;
  created_at: string;
}

interface BudgetRow {
  id: string;
  spent_usdg: string;
}

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`env var ${name} is required`);
  return v;
}

function parseArgs() {
  const dryRun = process.argv.includes("--dry-run");
  const maxAgeArg = process.argv.find((a) => a.startsWith("--max-age-hours="));
  const maxAgeHours = maxAgeArg ? Number(maxAgeArg.split("=")[1]) : 24;
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0) {
    throw new Error(`--max-age-hours must be a positive number`);
  }
  return { dryRun, maxAgeHours };
}

async function main() {
  const { dryRun, maxAgeHours } = parseArgs();
  const databaseUrl = envOrThrow("DATABASE_URL");
  const rpcUrl = envOrThrow("HELIUS_RPC_URL");

  const exec = neon(databaseUrl);
  const conn = new Connection(rpcUrl, "confirmed");

  console.log(`[reconcile] dryRun=${dryRun} maxAgeHours=${maxAgeHours}`);

  // Fetch pending spends with a queue signature but no callback signature.
  // Older than ~120s gives the SDK monitor a chance to land the callback
  // naturally before we step in. Younger rows are still in their normal
  // happy path; older than maxAgeHours is too old to be confident we can
  // resolve, so we leave them for a human (and log loudly).
  const rows = (await exec.query(
    `SELECT id, agent_id, amount_usdg::text AS amount_usdg, queue_signature, created_at
       FROM transactions
      WHERE status = 'pending'
        AND kind = 'spend'
        AND queue_signature IS NOT NULL
        AND callback_signature IS NULL
        AND created_at < now() - interval '120 seconds'
        AND created_at > now() - interval '${maxAgeHours} hours'
      ORDER BY created_at ASC
      LIMIT 200`,
  )) as PendingRow[];

  if (rows.length === 0) {
    console.log("[reconcile] no pending rows in window — done");
    return;
  }
  console.log(`[reconcile] processing ${rows.length} pending row(s)`);

  let confirmed = 0;
  let failed = 0;
  let skipped = 0;

  for (const row of rows) {
    const sig = row.queue_signature;
    let txInfo: Awaited<ReturnType<typeof conn.getTransaction>> = null;
    try {
      txInfo = await conn.getTransaction(sig, {
        maxSupportedTransactionVersion: 0,
      });
    } catch (err) {
      console.warn(
        `[reconcile] tx=${row.id} sig=${sig.slice(0, 8)}… RPC failed:`,
        err instanceof Error ? err.message : err,
      );
      skipped++;
      continue;
    }

    if (!txInfo) {
      // Either dropped from the leader cache (try again next run) or never
      // landed. Be conservative: leave pending and log.
      console.log(
        `[reconcile] tx=${row.id} sig=${sig.slice(0, 8)}… not found on chain — leaving pending`,
      );
      skipped++;
      continue;
    }

    if (txInfo.meta?.err) {
      console.log(
        `[reconcile] tx=${row.id} sig=${sig.slice(0, 8)}… failed on chain: ${JSON.stringify(txInfo.meta.err)}`,
      );
      if (!dryRun) {
        await markFailedAndRevertCap(exec, row);
      }
      failed++;
      continue;
    }

    // Tx landed successfully — Arcium has accepted the queue. Mark confirmed.
    console.log(
      `[reconcile] tx=${row.id} sig=${sig.slice(0, 8)}… confirmed on chain`,
    );
    if (!dryRun) {
      await exec.query(
        `UPDATE transactions
            SET status = 'confirmed',
                confirmed_at = now(),
                callback_status = COALESCE(callback_status, 'reconciled'),
                solana_sig = COALESCE(solana_sig, queue_signature)
          WHERE id = $1 AND status = 'pending'`,
        [row.id],
      );
    }
    confirmed++;
  }

  console.log(
    `[reconcile] done — confirmed=${confirmed} failed=${failed} skipped=${skipped}`,
  );
}

async function markFailedAndRevertCap(
  exec: ReturnType<typeof neon>,
  row: PendingRow,
): Promise<void> {
  // Find the agent's monthly budget. We decrement by the row's amount_usdg
  // so the cap counter realigns with on-chain truth (a failed queue tx
  // means the deduction did NOT happen).
  const budgetRows = (await exec.query(
    `SELECT id, spent_usdg::text AS spent_usdg FROM budgets
      WHERE agent_id = $1 AND period = 'monthly' LIMIT 1`,
    [row.agent_id],
  )) as BudgetRow[];

  if (budgetRows.length === 0) {
    console.warn(
      `[reconcile] tx=${row.id} agent=${row.agent_id} has no monthly budget — skipping cap revert`,
    );
  } else {
    const budget = budgetRows[0]!;
    await exec.query(
      `UPDATE budgets
          SET spent_usdg = GREATEST(spent_usdg - $1, 0),
              updated_at = now()
        WHERE id = $2`,
      [row.amount_usdg, budget.id],
    );
  }

  await exec.query(
    `UPDATE transactions
        SET status = 'failed',
            memo = COALESCE(memo, 'reconciler: queue tx failed on chain')
      WHERE id = $1 AND status = 'pending'`,
    [row.id],
  );
}

main().catch((err) => {
  console.error("[reconcile] fatal:", err);
  process.exit(1);
});
