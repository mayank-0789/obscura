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

// Sentinel on transactions.memo while the Umbra deposit is in-flight. Cleared on success.
const DEPOSIT_IN_FLIGHT_MEMO = "umbra_deposit_in_flight";

const PaymentMetadata = z.object({
  agent_id: z.string().uuid(),
  amount_inr_paise: z.string().regex(/^\d+$/),
  user_id: z.string().uuid(),
  rate_snapshot: z.string().regex(/^\d+(\.\d+)?$/),
});

// Idempotency layers, in order:
//   1. Signature verification.
//   2. webhook_log UNIQUE (provider, event_id) — same delivery never double-processes.
//   3. transactions UNIQUE (dodo_payment_id) — duplicate-credit defense.
//   4. DEPOSIT_IN_FLIGHT_MEMO bracket on the SDK call — refuses retry while a deposit may be mid-flight.
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
      return;
  }
}

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
    return apiError("server_error");
  }

  if (existing.processedAt) return apiOk({ ok: true });

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

  // Defense-in-depth: amount/currency mismatch guards.
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

  if (existingTx?.status === "failed") {
    throw new Error(
      `pending tx ${existingTx.id} for payment_id=${paymentId} is marked ` +
        `failed — operator must decide whether to retry or write off.`,
    );
  }

  // Umbra has no TransferAlreadyLanded equivalent — refuse to retry while a prior
  // deposit may be mid-flight on-chain (operator must reconcile encrypted balance).
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
  const { usdgMicros } = calculateTopupBreakdown(inrPaise, rate);
  assertU64(usdgMicros);
  console.info(
    `[topup ${paymentId}] breakdown ${inrPaise} paise @ rate=${rate} → ` +
      `${usdgMicros} micros (~$${(Number(usdgMicros) / 1_000_000).toFixed(2)} USDC)`,
  );

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

  await db
    .update(transactions)
    .set({ memo: DEPOSIT_IN_FLIGHT_MEMO })
    .where(eq(transactions.id, pendingTxId));
  console.info(
    `[topup ${paymentId}] in-flight memo set on tx ${pendingTxId} → calling Umbra deposit`,
  );

  const result = await depositTreasuryToEncryptedAccount({
    etaAddress: agent.etaAddress,
    amountMicros: usdgMicros,
  });

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

async function recordPaymentFailed(
  event: PaymentFailedWebhookEvent,
): Promise<void> {
  console.info(
    `[dodo/webhook] payment.failed payment_id=${event.data.payment_id} ` +
      `amount=${event.data.total_amount} currency=${event.data.currency}`,
  );
}

// refund.succeeded — no auto-action; operator decides.
async function recordRefund(
  event: RefundSucceededWebhookEvent,
): Promise<void> {
  const refund = event.data;
  console.error(
    `[dodo/webhook] REFUND: payment_id=${refund.payment_id} ` +
      `amount=${refund.amount ?? "full"} currency=${refund.currency ?? "n/a"} ` +
      `reason=${refund.reason ?? "n/a"} — no automated action, operator must decide`,
  );
  if (!refund.payment_id) return;
  const memo = `dodoRefunded:${refund.refund_id ?? "unknown"}:${refund.amount ?? "full"}`;
  const updated = await db
    .update(transactions)
    .set({ memo })
    .where(eq(transactions.dodoPaymentId, refund.payment_id))
    .returning({ id: transactions.id });
  if (updated.length === 0) {
    console.warn(
      `[dodo/webhook] REFUND: no transactions row found for payment_id=${refund.payment_id}`,
    );
  }
}

// dispute.opened — no auto-action; operator decides.
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
  if (!dispute.payment_id) return;
  const memo = `dodoDisputed:${dispute.dispute_id}:${dispute.dispute_stage}`;
  const updated = await db
    .update(transactions)
    .set({ memo })
    .where(eq(transactions.dodoPaymentId, dispute.payment_id))
    .returning({ id: transactions.id });
  if (updated.length === 0) {
    console.warn(
      `[dodo/webhook] DISPUTE: no transactions row found for payment_id=${dispute.payment_id}`,
    );
  }
}
