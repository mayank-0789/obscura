import "dotenv/config";
import { neon } from "@neondatabase/serverless";

// One-shot recovery: clears the in-flight memo on a stuck topup transaction
// row so the next webhook retry re-enters the deposit path cleanly. Use only
// when you're confident the prior deposit DID NOT land on-chain (e.g.,
// simulation failed pre-submission with a clear error in webhook_log.error).
//
// Usage: pnpm exec tsx scripts/clear-stuck-topup.ts <txId>
//        pnpm exec tsx scripts/clear-stuck-topup.ts <paymentId>
//
// Either the transaction UUID or the Dodo payment_id works.

async function main() {
  const arg = process.argv[2];
  if (!arg) throw new Error("usage: tsx scripts/clear-stuck-topup.ts <txId|paymentId>");

  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");
  const exec = neon(url);

  // Try matching against id first; fall back to dodo_payment_id.
  const isUuid = /^[0-9a-f]{8}-/i.test(arg);
  const where = isUuid
    ? "id = $1"
    : "dodo_payment_id = $1";

  const before = await exec.query(
    `SELECT id, status, memo, callback_signature, dodo_payment_id
       FROM transactions WHERE ${where} LIMIT 1`,
    [arg],
  );
  const row = (before as Array<Record<string, unknown>>)[0];
  if (!row) {
    console.log(`no row matching ${arg}`);
    return;
  }
  console.log("before:", row);

  if (row.status === "confirmed") {
    console.log("row already confirmed — nothing to clear");
    return;
  }
  if (row.callback_signature) {
    console.log(
      "callback_signature present — deposit DID land on-chain, refusing to clear",
    );
    return;
  }

  await exec.query(
    `UPDATE transactions
        SET memo = NULL, status = 'pending', queue_signature = NULL,
            callback_signature = NULL, callback_status = NULL
        WHERE ${where}`,
    [arg],
  );

  // Also clear the corresponding webhook_log row's error so Dodo's next
  // delivery (or a manual replay) re-enters processing fresh.
  if (typeof row.dodo_payment_id === "string") {
    await exec.query(
      `UPDATE webhook_log SET error = NULL, processed_at = NULL
         WHERE provider = 'dodo' AND payload->'data'->>'payment_id' = $1`,
      [row.dodo_payment_id],
    );
  }

  console.log("✓ cleared. Dodo will retry on its own schedule, or trigger");
  console.log("  a redelivery from the Dodo dashboard for the same payment_id.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
