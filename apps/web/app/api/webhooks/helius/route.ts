import { createHash, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import {
  db,
  transactions,
  agents,
  merchants,
  webhookLog,
} from "@/lib/db";
import { env } from "@/lib/env";
import { eventBroker, merchantPaymentTopic } from "@/lib/event-broker";
import { getConnection } from "@/lib/solana";

// POST /api/webhooks/helius — inbound Helius Enhanced Webhook. Fires whenever
// any watched account address (our registered merchant payout wallets) is a
// party to a Solana transaction.
//
// Responsibilities:
//   1. Verify the Authorization header matches HELIUS_WEBHOOK_AUTH_TOKEN
//      (constant-time) — otherwise anyone discovering the endpoint could
//      flip pending → confirmed on transactions they don't own.
//   2. Idempotency via webhook_log: (provider='helius', event_id=<sig>) is
//      unique, so a duplicate delivery of the same tx is a no-op UPSERT.
//   3. For each transfer of our stablecoin mint into a watched recipient,
//      find the matching pending transactions row (counterparty + amount +
//      sender_pubkey + recent) and UPDATE it to confirmed.
//   4. Publish a MerchantPaymentEvent to the in-process broker so any open
//      SSE subscriber on the merchant's dashboard invalidates its SWR cache.
//
// Returns 200 on every well-auth'd request (including no-op duplicates) so
// Helius doesn't retry us to death.

// Pending rows older than this window are ignored — we don't want a very old
// pending (likely orphaned by a mid-flight failure in the SDK / facilitator)
// to get auto-confirmed by an unrelated same-amount transfer.
const CONFIRM_WINDOW_MINUTES = 60;

// Solana ed25519 signature in base58 is 87–88 chars, using the base58
// alphabet (no 0, O, I, l). Pre-filter before any RPC call or DB write so
// an attacker with a leaked auth token can't pollute solana_sig with junk.
const SOLANA_SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

// Helius Enhanced webhook payload — we only use a subset. The full schema
// has many more fields; we keep validation loose on optional fields so a
// schema drift from Helius doesn't 500 us.
const TokenTransferSchema = z.object({
  mint: z.string(),
  tokenAmount: z.number().optional(),
  // Raw atomic units. Helius provides this for most events; when missing we
  // fall back to (tokenAmount * 10^decimals). Match on raw when available.
  rawTokenAmount: z
    .object({
      tokenAmount: z.string(),
      decimals: z.number(),
    })
    .optional(),
  fromUserAccount: z.string().nullable().optional(),
  toUserAccount: z.string().nullable().optional(),
});

const EventSchema = z.object({
  signature: z.string(),
  timestamp: z.number().optional(),
  tokenTransfers: z.array(TokenTransferSchema).optional().default([]),
});

const BodySchema = z.array(EventSchema);

export async function POST(req: Request) {
  if (!verifyAuth(req)) {
    // Do NOT return a descriptive error — keep it opaque.
    return new Response(null, { status: 401 });
  }

  let events: z.infer<typeof BodySchema>;
  try {
    events = BodySchema.parse(await req.json());
  } catch {
    // Malformed body → 400. Helius shouldn't be sending malformed payloads;
    // if it is we want a loud log + fast fail, not a silent retry loop.
    console.error("[helius-webhook] malformed body");
    return new Response(null, { status: 400 });
  }

  let processed = 0;
  let skipped = 0;

  for (const event of events) {
    try {
      const outcome = await handleEvent(event);
      if (outcome === "processed") processed += 1;
      else skipped += 1;
    } catch (err) {
      // Don't let one bad event tank the batch.
      console.error(
        `[helius-webhook] event ${event.signature} failed:`,
        err,
      );
      skipped += 1;
    }
  }

  return Response.json({ processed, skipped });
}

// --------------------------------------------------------------------------

function verifyAuth(req: Request): boolean {
  const expected = env.HELIUS_WEBHOOK_AUTH_TOKEN;
  if (!expected) {
    // No token configured → accept nothing. Safer to block than to let
    // unauthed calls flip tx state.
    console.warn(
      "[helius-webhook] HELIUS_WEBHOOK_AUTH_TOKEN not set; rejecting all inbound",
    );
    return false;
  }
  const received = req.headers.get("authorization");
  if (!received) return false;

  // Compare fixed-length SHA-256 digests instead of the raw tokens. This
  // closes the length-probe side channel (an attacker enumerating the secret's
  // byte length by timing 401 responses against equal-length responses) at
  // zero real cost.
  const expDigest = createHash("sha256").update(expected).digest();
  const recvDigest = createHash("sha256").update(received).digest();
  return timingSafeEqual(expDigest, recvDigest);
}

type HandleOutcome = "processed" | "skipped";

async function handleEvent(
  event: z.infer<typeof EventSchema>,
): Promise<HandleOutcome> {
  const transfers = event.tokenTransfers ?? [];
  const stablecoinTransfers = transfers.filter(
    (t) => t.mint === env.STABLECOIN_MINT,
  );
  if (stablecoinTransfers.length === 0) return "skipped";

  // Reject malformed signatures BEFORE any DB write. Prevents an attacker
  // holding a leaked HELIUS_WEBHOOK_AUTH_TOKEN from polluting solana_sig or
  // webhook_log.event_id with arbitrary bytes.
  if (!SOLANA_SIG_RE.test(event.signature)) {
    console.warn(
      `[helius-webhook] rejecting event with malformed signature: ${event.signature.slice(0, 20)}…`,
    );
    return "skipped";
  }

  // Verify the signature exists on-chain and confirmed. This is the key
  // defense against B3 (spoofed-payload money flip): even with a leaked
  // auth token, an attacker can't forge a Solana transaction signature —
  // getSignatureStatuses will either return null (sig not found) or err.
  // Cost: one RPC call per matched event. Trivial at current volumes.
  const onchainOk = await verifySignatureOnChain(event.signature);
  if (!onchainOk) {
    console.warn(
      `[helius-webhook] signature not confirmed on-chain: ${event.signature.slice(0, 12)}…`,
    );
    return "skipped";
  }

  // Idempotency guard. INSERT into webhook_log with (provider, event_id)
  // unique. If the row already exists ON CONFLICT DO NOTHING returns zero
  // rows → this is a re-delivery, we're done. Placed AFTER the on-chain
  // check so a forged event that failed verification doesn't permanently
  // occupy an event_id an attacker could use to pre-empt a real delivery.
  const [logged] = await db
    .insert(webhookLog)
    .values({
      provider: "helius",
      eventId: event.signature,
      payload: event,
      processedAt: new Date(),
    })
    .onConflictDoNothing({
      target: [webhookLog.provider, webhookLog.eventId],
    })
    .returning({ id: webhookLog.id });
  if (!logged) return "skipped";

  for (const transfer of stablecoinTransfers) {
    await confirmPendingTx(event.signature, transfer);
  }
  return "processed";
}

async function verifySignatureOnChain(signature: string): Promise<boolean> {
  try {
    const connection = getConnection();
    const { value } = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const status = value[0];
    if (!status) return false;
    if (status.err) return false;
    // 'processed' is not durable; require 'confirmed' or 'finalized'.
    return (
      status.confirmationStatus === "confirmed" ||
      status.confirmationStatus === "finalized"
    );
  } catch (err) {
    console.error(
      `[helius-webhook] getSignatureStatuses failed for ${signature.slice(0, 12)}…:`,
      err,
    );
    return false;
  }
}

async function confirmPendingTx(
  signature: string,
  transfer: z.infer<typeof TokenTransferSchema>,
): Promise<void> {
  if (!transfer.toUserAccount || !transfer.fromUserAccount) return;

  const amount = extractAtomicAmount(transfer);
  if (amount === null) return;

  // Match the most-recent pending row where:
  //   - counterparty == recipient
  //   - amount_usdg == transferred amount
  //   - the agent's on-chain pubkey == transfer.fromUserAccount
  //   - created within CONFIRM_WINDOW_MINUTES
  //   - still pending
  // The agent-pubkey join is what makes this specific — matching by recipient
  // + amount alone could confuse two merchants serving the same agent at the
  // same price at the same time.
  //
  // Edge case — same agent pays same merchant the same amount back-to-back:
  // `desc(createdAt) limit 1` always picks the newest pending. If the FIRST
  // payment lands on-chain before the second (normal ordering), the webhook
  // fires twice and we attach the right signature to the right row by
  // coincidence of sequence. If ordering inverts (rare — facilitator reorders
  // a batch), one row ends up with the wrong sig until a reconciler sweeps.
  // Dashboard display is unaffected (amounts are identical). Acceptable.
  const windowStart = new Date(
    Date.now() - CONFIRM_WINDOW_MINUTES * 60 * 1000,
  );
  const matches = await db
    .select({ id: transactions.id })
    .from(transactions)
    .innerJoin(agents, eq(agents.id, transactions.agentId))
    .where(
      and(
        eq(transactions.counterparty, transfer.toUserAccount),
        eq(transactions.amountUsdg, amount),
        eq(transactions.status, "pending"),
        eq(transactions.kind, "spend"),
        eq(agents.etaAddress, transfer.fromUserAccount),
        gte(transactions.createdAt, windowStart),
      ),
    )
    .orderBy(desc(transactions.createdAt))
    .limit(1);

  const match = matches[0];
  if (!match) {
    console.warn(
      `[helius-webhook] no pending tx matched sig=${signature.slice(0, 12)}… ` +
        `to=${transfer.toUserAccount} from=${transfer.fromUserAccount} amount=${amount}`,
    );
    return;
  }

  const [updated] = await db
    .update(transactions)
    .set({
      status: "confirmed",
      solanaSig: signature,
      confirmedAt: new Date(),
    })
    .where(eq(transactions.id, match.id))
    .returning();
  if (!updated) return;

  // Look up the canonical merchant ETA address and use it as the broker topic
  // key. Belt-and-braces vs Helius normalizing the recipient differently than
  // our stored form — an SSE subscriber subscribes using its auth context's
  // `merchant.etaAddress`, so the publish key must come from the same source.
  const [merchantRow] = await db
    .select({ etaAddress: merchants.etaAddress })
    .from(merchants)
    .where(eq(merchants.etaAddress, updated.counterparty))
    .limit(1);
  const topicKey = merchantRow?.etaAddress ?? updated.counterparty;

  eventBroker.publish(merchantPaymentTopic(topicKey), {
    kind: "payment",
    transactionId: updated.id,
    amountUsdg: updated.amountUsdg.toString(),
    counterparty: updated.counterparty,
    merchantHost: updated.merchantHost,
    solanaSig: signature,
    createdAt: updated.createdAt.toISOString(),
    confirmedAt: (updated.confirmedAt ?? new Date()).toISOString(),
  });
}

function extractAtomicAmount(
  transfer: z.infer<typeof TokenTransferSchema>,
): bigint | null {
  // Prefer rawTokenAmount (already atomic) — more precise and avoids floating
  // point. Fall back to tokenAmount * 10^decimals using the configured
  // stablecoin decimals if raw is absent.
  if (transfer.rawTokenAmount) {
    try {
      return BigInt(transfer.rawTokenAmount.tokenAmount);
    } catch {
      return null;
    }
  }
  if (typeof transfer.tokenAmount === "number") {
    // Scale by 10^STABLECOIN_DECIMALS, floor to avoid floating-point artifacts.
    const scale = 10 ** env.STABLECOIN_DECIMALS;
    return BigInt(Math.floor(transfer.tokenAmount * scale));
  }
  return null;
}
