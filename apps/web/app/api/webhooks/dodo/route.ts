import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { PaymentSucceededWebhookEvent } from "dodopayments/resources/webhooks/webhooks";
import {
  PublicKey,
  transferSpl,
  TransferAlreadyLanded,
  TransferNeverLanded,
} from "@payrail/solana";
import {
  db,
  agents,
  transactions,
  webhookLog,
  type WebhookLog,
} from "@/lib/db";
import { apiError, apiOk } from "@/lib/api";
import { verifyDodoWebhook, WebhookVerifyError } from "@/lib/dodo/webhook";
import { quoteInrToUsdg } from "@/lib/rates";
import { getConnection, getStablecoinMint, getTreasury } from "@/lib/solana";
import { env } from "@/lib/env";

// Metadata we set on every checkout session. Validated with Zod so drift in
// Dodo's payload shape surfaces as a clean error instead of a silent KeyError.
const PaymentMetadata = z.object({
  agent_id: z.string().uuid(),
  amount_inr_paise: z.string().regex(/^\d+$/),
  user_id: z.string().uuid(),
});

// POST /api/webhooks/dodo — receive payment events from Dodo and credit the
// agent wallet on `payment.succeeded`.
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
    if (event.type === "payment.succeeded") {
      await creditAgentForPayment(event);
    }
    await markProcessed(claim.id);
    return apiOk({ ok: true });
  } catch (err) {
    console.error("[dodo/webhook] processing failed", event.type, err);
    await markErrored(claim.id, err);
    return apiError("server_error");
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

  const inrPaise = BigInt(metadata.amount_inr_paise);
  const { usdg: usdgMicros, rate } = quoteInrToUsdg(inrPaise);

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
