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
  db,
  agents,
  transactions,
  webhookLog,
  type WebhookLog,
} from "@/lib/db";
import { apiError, apiOk } from "@/lib/api";
import { verifyDodoWebhook, WebhookVerifyError } from "@/lib/dodo/webhook";
import { calculateTopupBreakdown } from "@/lib/pricing";
import { depositTreasuryToEncryptedAccount } from "@/lib/umbra";
import { assertU64 } from "@umbra-privacy/sdk/types";

// Sentinel written into transactions.memo while the Umbra deposit SDK call is
// in-flight. Cleared on success. On a webhook retry, finding this memo on a
// pending row means the prior attempt MAY have landed on-chain — without an
// equivalent of TransferAlreadyLanded for the Umbra path, we can't tell, and
// must refuse to re-issue rather than risk a double-credit.
const DEPOSIT_IN_FLIGHT_MEMO = "umbra_deposit_in_flight";

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
// Idempotency layers, in order:
//   1. Signature verification.
//   2. webhook_log UNIQUE (provider, event_id) — same delivery never
//      double-processes.
//   3. transactions row inserted BEFORE the on-chain Umbra deposit, with
//      status='pending'. The deposit path is bracketed by a memo flip:
//      memo='umbra_deposit_in_flight' is written before the SDK call, and
//      cleared (with status='confirmed' + the Arcium callback signature)
//      after `callbackStatus='finalized'`. On retry, an in-flight memo with
//      no callback_signature means we MAY have double-credit risk and we
//      refuse to re-issue — an operator must verify the agent's encrypted
//      balance and either clear the memo (mark confirmed, attaching the
//      actual on-chain signature) or null it out and let the next retry
//      proceed. Retry-safe by design, because the SDK's deposit is NOT
//      naturally idempotent (no TransferAlreadyLanded equivalent the way the
//      legacy SPL path had).
//   4. Retries of a failed claim clear webhook_log.error and re-enter the
//      same idempotent processing path. No row gets permanently stuck.
//
// Dispatched event types (everything else is acknowledged + markProcessed):
//   - payment.succeeded  → credit the agent's Umbra encrypted account
//   - payment.failed     → log (informational; Dodo never collected)
//   - refund.succeeded   → log loudly. We have no user-facing refund flow,
//                          so refunds can only arrive out-of-band (Dodo
//                          support / bank chargeback). No ledger write, no
//                          on-chain clawback — an operator reacts to the log.
//   - dispute.opened     → log loudly; same reasoning. No auto-action.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const deliveryId = req.headers.get("webhook-id");
  console.info(
    `[dodo/webhook] ↓ delivery=${deliveryId ?? "(missing)"} bytes=${rawBody.length}`,
  );

  let event;
  try {
    event = verifyDodoWebhook(rawBody, req.headers);
  } catch (err) {
    if (err instanceof WebhookVerifyError) {
      console.warn("[dodo/webhook] signature verify FAILED", err.message);
      return apiError("invalid_signature");
    }
    throw err;
  }
  console.info(
    `[dodo/webhook] signature OK delivery=${deliveryId} type=${event.type}`,
  );

  if (!deliveryId) return apiError("bad_request");

  const claim = await claimEvent(deliveryId, rawBody);
  if (claim instanceof Response) return claim;

  try {
    await dispatchEvent(event);
    await markProcessed(claim.id);
    console.info(
      `[dodo/webhook] ✓ delivery=${deliveryId} type=${event.type} processed`,
    );
    return apiOk({ ok: true });
  } catch (err) {
    console.error(
      `[dodo/webhook] ✗ delivery=${deliveryId} type=${event.type} processing FAILED`,
      err,
    );
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
  console.info(
    `[topup ${paymentId}] payment.succeeded agent=${metadata.agent_id} ` +
      `paise=${metadata.amount_inr_paise} rate=${metadata.rate_snapshot}`,
  );

  // Defense in depth — every money-relevant field from the webhook payload is
  // cross-checked against what we asked for at session creation. Any mismatch
  // throws, webhook_log.error captures it, no credit happens.
  if (event.data.currency !== "INR") {
    throw new Error(
      `currency_mismatch: expected=INR actual=${event.data.currency}`,
    );
  }

  const expectedPaise = BigInt(metadata.amount_inr_paise);
  const actualPaise = BigInt(event.data.total_amount);
  if (expectedPaise !== actualPaise) {
    throw new Error(
      `amount_mismatch: expected=${expectedPaise} actual=${actualPaise} ` +
        `(check Dodo product: Pay What You Want + no discount code)`,
    );
  }
  console.info(
    `[topup ${paymentId}] guards passed currency=INR paise=${expectedPaise}`,
  );

  // Has this payment already been credited (or started crediting)?
  const [existingTx] = await db
    .select({
      id: transactions.id,
      status: transactions.status,
      memo: transactions.memo,
      callbackSignature: transactions.callbackSignature,
    })
    .from(transactions)
    .where(eq(transactions.dodoPaymentId, paymentId))
    .limit(1);

  if (existingTx?.status === "confirmed") {
    console.info(
      `[topup ${paymentId}] tx ${existingTx.id} already confirmed — no-op`,
    );
    return;
  }

  // Defensive: nothing in this code path writes 'failed' today, but the enum
  // allows it and a future reconciler/operator tool likely will. If we ever
  // hit a failed row, refuse to silently re-issue — an operator must decide
  // whether to retry (clear the row's status) or treat the top-up as lost.
  if (existingTx?.status === "failed") {
    throw new Error(
      `pending tx ${existingTx.id} for payment_id=${paymentId} is marked ` +
        `failed — operator must decide whether to retry or write off.`,
    );
  }

  // Refuse to retry while a previous deposit may be mid-flight on-chain.
  // The Umbra SDK has no "already landed" recovery analogous to the legacy
  // TransferAlreadyLanded — re-issuing here would risk a second on-chain
  // treasury → ETA deposit and a double-credit. An operator must decrypt the
  // agent's encrypted balance and either clear the memo (mark confirmed,
  // attaching the actual callback signature) or null it out and let the next
  // retry proceed.
  if (
    existingTx?.memo === DEPOSIT_IN_FLIGHT_MEMO &&
    !existingTx.callbackSignature
  ) {
    throw new Error(
      `pending tx ${existingTx.id} for payment_id=${paymentId} found with ` +
        `in-flight deposit memo on retry — manual reconciliation needed ` +
        `(check encrypted balance for the agent before clearing).`,
    );
  }

  // Load the agent. Must already be Umbra-registered — agent creation is
  // eager-register, so any agent that exists has a usable encrypted account.
  // If somehow umbraStatus is null (older row, manual seed, etc.) we refuse
  // — depositing into an unregistered ETA fails on-chain anyway, and we
  // don't want partially-credited DB state.
  const [agent] = await db
    .select({
      id: agents.id,
      etaAddress: agents.etaAddress,
      umbraStatus: agents.umbraStatus,
    })
    .from(agents)
    .where(eq(agents.id, metadata.agent_id))
    .limit(1);
  if (!agent) throw new Error(`agent ${metadata.agent_id} not found`);
  if (agent.umbraStatus !== "active") {
    throw new Error(
      `agent ${agent.id} umbraStatus=${agent.umbraStatus ?? "null"} — ` +
        `not registered on Umbra; cannot deposit`,
    );
  }
  console.info(
    `[topup ${paymentId}] agent loaded id=${agent.id} ` +
      `etaAddress=${agent.etaAddress} umbraStatus=${agent.umbraStatus}`,
  );

  const inrPaise = expectedPaise;
  const rate = Number(metadata.rate_snapshot);
  // Deterministic re-compute from the market rate locked at checkout + the
  // charged amount. Produces the same USDG the user saw on the breakdown
  // card. `rate` here is the market rate; pricing applies the spread inside.
  const { usdgMicros } = calculateTopupBreakdown(inrPaise, rate);
  // Validate the boundary value is a valid U64 once, here where it enters
  // the system. assertU64 narrows the bigint to the branded U64 type so the
  // Umbra SDK accepts it downstream without further validation.
  assertU64(usdgMicros);
  console.info(
    `[topup ${paymentId}] breakdown ${inrPaise} paise @ rate=${rate} → ` +
      `${usdgMicros} micros (~$${(Number(usdgMicros) / 1_000_000).toFixed(2)} USDC)`,
  );

  // Pre-insert a pending row so a retry finds it and doesn't create a
  // duplicate. Three meaningful states to recognise on retry:
  //   - row pending, memo NULL, callback_signature NULL → safe to (re-)try
  //                                                       the deposit.
  //   - row pending, memo='umbra_deposit_in_flight', callback_signature NULL
  //     → deposit SDK call is running OR crashed mid-call; refuse to retry
  //       (see check above).
  //   - row confirmed, callback_signature set → fully complete; no-op.
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
  console.info(
    `[topup ${paymentId}] pending tx ${existingTx ? "reused" : "inserted"} id=${pendingTxId}`,
  );

  // Bracket the SDK call with an in-flight memo so a webhook retry that
  // arrives while the deposit is still resolving (or after it resolved but
  // before the confirmed-update lands) refuses to re-issue. Cleared on the
  // success update below.
  await db
    .update(transactions)
    .set({ memo: DEPOSIT_IN_FLIGHT_MEMO })
    .where(eq(transactions.id, pendingTxId));
  console.info(
    `[topup ${paymentId}] in-flight memo set on tx ${pendingTxId} → calling Umbra deposit`,
  );

  // Treasury → agent encrypted account. The deposit *event* (sender,
  // recipient, mint, gross amount) is publicly visible on-chain by design;
  // the resulting encrypted balance value is hidden. See the architectural
  // notes in lib/umbra.ts for why we accept this trade-off.
  const result = await depositTreasuryToEncryptedAccount({
    etaAddress: agent.etaAddress,
    amountMicros: usdgMicros,
  });

  // The Arcium MPC callback tx is the canonical "deposit landed" signal —
  // the queue tx alone only proves we asked. When callbackSignature is
  // undefined (status "timed-out"/"pruned"), the on-chain queue tx may still
  // finalize asynchronously and credit the agent; we therefore leave the
  // in-flight memo set and throw, so the next retry (whether webhook
  // redelivery or operator-driven) hits the in-flight refusal above and
  // surfaces for manual reconciliation rather than blindly re-depositing.
  if (!result.callbackSignature) {
    throw new Error(
      `umbra deposit callback ${result.callbackStatus ?? "missing"}: ` +
        `queue=${result.queueSignature} — in-flight memo retained, ` +
        `manual reconciliation needed`,
    );
  }

  await db
    .update(transactions)
    .set({
      status: "confirmed",
      solanaSig: String(result.callbackSignature),
      queueSignature: String(result.queueSignature),
      callbackSignature: String(result.callbackSignature),
      callbackStatus: result.callbackStatus ?? null,
      memo: null,
      confirmedAt: new Date(),
    })
    .where(eq(transactions.id, pendingTxId));
  console.info(
    `[topup ${paymentId}] ✓ tx ${pendingTxId} confirmed — ` +
      `$${(Number(usdgMicros) / 1_000_000).toFixed(2)} USDC landed in encrypted account ` +
      `${agent.etaAddress} callbackSig=${result.callbackSignature}`,
  );
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
// recovery via the agent's encrypted balance if it hasn't been spent yet,
// or absorb the loss if it has). Revisit when we ship a refund flow.
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
