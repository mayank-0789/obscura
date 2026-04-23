import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type {
  DisputeOpenedWebhookEvent,
  PaymentFailedWebhookEvent,
  PaymentSucceededWebhookEvent,
  RefundSucceededWebhookEvent,
  UnwrapWebhookEvent,
} from "dodopayments/resources/webhooks/webhooks";
import {
  PublicKey,
  transferSpl,
  TransferAlreadyLanded,
  TransferNeverLanded,
} from "@payrail-app/solana";
import {
  db,
  agents,
  transactions,
  webhookLog,
  type WebhookLog,
} from "@/lib/db";
import { apiError, apiOk } from "@/lib/api";
import { verifyDodoWebhook, WebhookVerifyError } from "@/lib/dodo/webhook";
import { calculateTopupBreakdown } from "@/lib/pricing";
import { getConnection, getStablecoinMint, getTreasury } from "@/lib/solana";
import { env } from "@/lib/env";

// Metadata we set on every checkout session. Validated with Zod so drift in
// Dodo's payload shape surfaces as a clean error instead of a silent KeyError.
const PaymentMetadata = z.object({
  agent_id: z.string().uuid(),
  amount_inr_paise: z.string().regex(/^\d+$/),
  user_id: z.string().uuid(),
  // Rate at the time the checkout intent was created. Locked here so the
  // webhook credits exactly the USDG we promised in the UI breakdown,
  // regardless of how the live rate has moved since.
  rate_snapshot: z.string().regex(/^\d+(\.\d+)?$/),
});

// POST /api/webhooks/dodo — receive payment events from Dodo and dispatch.
//
// Four layers of safety, in order:
//   1. Signature verification.
//   2. webhook_log UNIQUE (provider, event_id) — same delivery never
//      double-processes.
//   3. transactions row inserted BEFORE transferSpl with status='pending'. If
//      the transfer lands but we crash before the confirmed-update, a retry
//      finds the pending row and either claims the landed signature
//      (TransferAlreadyLanded) or retries cleanly (TransferNeverLanded).
//   4. Retries of a failed claim clear webhook_log.error and re-enter the
//      same idempotent processing path. No row gets permanently stuck.
//
// Dispatched event types (everything else is acknowledged + markProcessed):
//   - payment.succeeded  → credit the agent wallet with USDG
//   - payment.failed     → log (informational; Dodo never collected)
//   - refund.succeeded   → log loudly. We have no user-facing refund flow,
//                          so refunds can only arrive out-of-band (Dodo
//                          support / bank chargeback). No ledger write, no
//                          on-chain clawback — an operator reacts to the log.
//   - dispute.opened     → log loudly; same reasoning. No auto-action.
export async function POST(req: Request) {
  const rawBody = await req.text();

  let event;
  try {
    event = verifyDodoWebhook(rawBody, req.headers);
  } catch (err) {
    if (err instanceof WebhookVerifyError) {
      console.warn("[dodo/webhook] signature verify failed", err.message);
      return apiError("invalid_signature");
    }
    throw err;
  }

  const deliveryId = req.headers.get("webhook-id");
  if (!deliveryId) return apiError("bad_request");

  const claim = await claimEvent(deliveryId, rawBody);
  if (claim instanceof Response) return claim;

  try {
    await dispatchEvent(event);
    await markProcessed(claim.id);
    return apiOk({ ok: true });
  } catch (err) {
    console.error("[dodo/webhook] processing failed", event.type, err);
    await markErrored(claim.id, err);
    return apiError("server_error");
  }
}

async function dispatchEvent(event: UnwrapWebhookEvent): Promise<void> {
  switch (event.type) {
    case "payment.succeeded":
      await creditAgentForPayment(event);
      return;
    case "payment.failed":
      await recordPaymentFailed(event);
      return;
    case "refund.succeeded":
      await recordRefund(event);
      return;
    case "dispute.opened":
      await recordDisputeOpened(event);
      return;
    default:
      // Any other event type — acknowledge and move on. Dodo emits dozens of
      // subscription/credit/dispute-stage events we don't consume; logging
      // them at debug level keeps logs clean while still being traceable.
      return;
  }
}

// Acquires the idempotency claim. Three outcomes:
//   - New event: we get a fresh row, proceed with processing.
//   - Already processed (processed_at set): 200 no-op.
//   - Previously attempted but errored: clear the error and re-enter processing.
//     Downstream code is idempotent, so this retries safely.
async function claimEvent(
  deliveryId: string,
  rawBody: string,
): Promise<WebhookLog | Response> {
  const [inserted] = await db
    .insert(webhookLog)
    .values({
      provider: "dodo",
      eventId: deliveryId,
      payload: JSON.parse(rawBody),
    })
    .onConflictDoNothing({
      target: [webhookLog.provider, webhookLog.eventId],
    })
    .returning();

  if (inserted) return inserted;

  const [existing] = await db
    .select()
    .from(webhookLog)
    .where(
      and(
        eq(webhookLog.provider, "dodo"),
        eq(webhookLog.eventId, deliveryId),
      ),
    )
    .limit(1);

  if (!existing) {
    // Shouldn't happen — the insert conflicted so a row must exist. Defensive.
    return apiError("server_error");
  }

  if (existing.processedAt) return apiOk({ ok: true });

  // Prior attempt failed. Clear the error marker and let the caller re-enter
  // the processing path; creditAgentForPayment is idempotent by design.
  await db
    .update(webhookLog)
    .set({ error: null })
    .where(eq(webhookLog.id, existing.id));
  return existing;
}

async function markProcessed(claimId: string) {
  await db
    .update(webhookLog)
    .set({ processedAt: new Date(), error: null })
    .where(eq(webhookLog.id, claimId));
}

async function markErrored(claimId: string, err: unknown) {
  await db
    .update(webhookLog)
    .set({ error: err instanceof Error ? err.message : String(err) })
    .where(eq(webhookLog.id, claimId));
}

async function creditAgentForPayment(event: PaymentSucceededWebhookEvent) {
  const metadata = PaymentMetadata.parse(event.data.metadata);
  const paymentId = event.data.payment_id;

  // Defense in depth — every money-relevant field from the webhook payload is
  // cross-checked against what we asked for at session creation. Any mismatch
  // throws, webhook_log.error captures it, no credit happens.
  //
  // Currency: must be INR. Session flags disable currency selection so this
  // should never trip in practice; present to catch merchant-config drift.
  if (event.data.currency !== "INR") {
    throw new Error(
      `currency_mismatch: expected=INR actual=${event.data.currency}`,
    );
  }

  // Amount: what Dodo collected must equal what we asked for. Catches the
  // classic footgun where a Fixed-Price product silently ignores our `amount`,
  // or a rogue discount code slipping through despite allow_discount_code=false.
  const expectedPaise = BigInt(metadata.amount_inr_paise);
  const actualPaise = BigInt(event.data.total_amount);
  if (expectedPaise !== actualPaise) {
    throw new Error(
      `amount_mismatch: expected=${expectedPaise} actual=${actualPaise} ` +
        `(check Dodo product: Pay What You Want + no discount code)`,
    );
  }

  // Has this payment already been credited (or started crediting)?
  const [existingTx] = await db
    .select({ id: transactions.id, status: transactions.status })
    .from(transactions)
    .where(eq(transactions.dodoPaymentId, paymentId))
    .limit(1);

  if (existingTx?.status === "confirmed") {
    // Prior attempt completed. Webhook retry — no-op.
    return;
  }

  const [agent] = await db
    .select({ id: agents.id, publicKey: agents.publicKey })
    .from(agents)
    .where(eq(agents.id, metadata.agent_id))
    .limit(1);
  if (!agent) throw new Error(`agent ${metadata.agent_id} not found`);

  const inrPaise = expectedPaise;
  const rate = Number(metadata.rate_snapshot);
  // Deterministic re-compute from the market rate locked at checkout + the
  // charged amount. Produces the same USDG the user saw on the breakdown
  // card. `rate` here is the market rate; pricing applies the spread inside.
  const { usdgMicros } = calculateTopupBreakdown(inrPaise, rate);

  // Pre-insert a pending row so if we crash between transfer and update, the
  // next attempt finds this row and doesn't create a duplicate — and on
  // TransferAlreadyLanded we can still claim the signature.
  const pendingTxId =
    existingTx?.id ??
    (
      await db
        .insert(transactions)
        .values({
          agentId: agent.id,
          kind: "topup",
          direction: "in",
          amountUsdg: usdgMicros,
          amountInr: inrPaise,
          rateSnapshot: rate.toString(),
          counterparty: "TREASURY",
          dodoPaymentId: paymentId,
          status: "pending",
        })
        .returning({ id: transactions.id })
    )[0]!.id;

  let signature: string;
  try {
    const result = await transferSpl({
      connection: getConnection(),
      from: getTreasury(),
      to: new PublicKey(agent.publicKey),
      mint: getStablecoinMint(),
      amount: usdgMicros,
      decimals: env.STABLECOIN_DECIMALS,
    });
    signature = result.signature;
  } catch (err) {
    if (err instanceof TransferAlreadyLanded) {
      // Prior attempt's tx DID land on-chain even though its confirmation
      // timed out locally. Claim the signature and move on.
      signature = err.signature;
    } else if (err instanceof TransferNeverLanded) {
      // Confirmed not-landed. Pending row stays. Dodo retries.
      throw err;
    } else {
      // Any other error — keep pending row, surface to webhook handler.
      throw err;
    }
  }

  await db
    .update(transactions)
    .set({
      status: "confirmed",
      solanaSig: signature,
      confirmedAt: new Date(),
    })
    .where(eq(transactions.id, pendingTxId));
}

// payment.failed — Dodo never collected from the user (card declined, UPI
// timeout, etc.). No ledger mutation is needed because payment.succeeded was
// never received and no USDG was credited. Log at info level for visibility
// into funnel drop-off.
async function recordPaymentFailed(
  event: PaymentFailedWebhookEvent,
): Promise<void> {
  console.info(
    `[dodo/webhook] payment.failed payment_id=${event.data.payment_id} ` +
      `amount=${event.data.total_amount} currency=${event.data.currency}`,
  );
}

// refund.succeeded — Dodo has returned INR to the user. We have no
// user-facing refund flow, so refunds can only arrive out-of-band (Dodo
// support ticket, bank chargeback). No ledger mutation, no on-chain
// clawback — an operator sees the log and decides what to do (manual USDG
// recovery via Privy if the agent hasn't spent the balance yet, or just
// absorb the loss if they have). Revisit when we build a refund flow into
// the product.
async function recordRefund(
  event: RefundSucceededWebhookEvent,
): Promise<void> {
  const refund = event.data;
  console.error(
    `[dodo/webhook] REFUND: payment_id=${refund.payment_id} ` +
      `amount=${refund.amount ?? "full"} currency=${refund.currency ?? "n/a"} ` +
      `reason=${refund.reason ?? "n/a"} — no automated action, operator must decide`,
  );
}

// dispute.opened — a chargeback has been filed. Funds are frozen at Dodo
// pending investigation; if we lose, a refund.succeeded follows. Same
// rationale as refunds — no ledger mutation, operator reacts to the log.
async function recordDisputeOpened(
  event: DisputeOpenedWebhookEvent,
): Promise<void> {
  const dispute = event.data;
  console.error(
    `[dodo/webhook] DISPUTE OPENED: payment_id=${dispute.payment_id} ` +
      `dispute_id=${dispute.dispute_id} amount=${dispute.amount} ` +
      `currency=${dispute.currency} stage=${dispute.dispute_stage} ` +
      `— operator action may be required`,
  );
}
