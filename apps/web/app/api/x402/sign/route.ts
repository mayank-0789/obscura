// POST /api/x402/sign — the heart of Payrail's agent-spending loop.
//
// Called by @payrail-app/sdk when an agent's fetch() receives a 402 from a paid
// API. We authenticate the caller via the agent's API key, enforce the monthly
// spend cap, and execute the confidential transfer from the agent's ETA into
// the merchant's ETA via the Umbra mixer (Path B). Returns a base64-encoded
// "umbra" payment header carrying the on-chain proofs the merchant verifies
// before serving the resource.
//
// Auth model: Bearer <agent-api-key>. Separate from user-JWT routes — the
// caller here is an agent's process, not a human with a session.
//
// Atomicity: cap check + spend-increment run as a single UPDATE WHERE
// RETURNING. Zero rows back = over cap. Race-safe even under concurrency; a
// read-then-write would let parallel signs blow through the cap.
//
// Mixer protocol divergence vs. classic x402:
//   - Classic x402-solana hands the merchant a signed SPL transfer; merchant
//     forwards to a facilitator that broadcasts it. Settlement is synchronous.
//   - Mixer (Path B) deducts from the agent's encrypted balance and inserts a
//     UTXO commitment in the on-chain mixer tree, addressed to the merchant.
//     The merchant's claim daemon picks it up later. Settlement is async, and
//     the recipient's wallet is unobservable from the deposit tx.
//
// We pay this latency cost (proof gen + Arcium MPC callback ≈ 10–25s) in
// exchange for two privacy properties no classic rail offers: on-chain link
// between sender ETA and recipient ETA is broken by the mixer, and the
// transferred amount is encrypted. The merchant only sees the queue signature
// + the destination address it recognises as its own.

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, budgets, transactions } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api";
import { agentAuthGuard } from "@/lib/agent-auth";
import { env } from "@/lib/env";
import { createReceiverClaimableUtxo } from "@/lib/umbra";
import { PublicKey } from "@payrail-app/solana";
import type { PaymentRequired, PaymentRequirements } from "x402-solana";

const SignBody = z.object({
  // base64-encoded JSON of PaymentRequired from the merchant's 402 response.
  paymentRequiredHeader: z.string().min(1),
  // Original URL the agent tried to GET — used for display/auditing + the
  // payment payload's `resource` field.
  resourceUrl: z.string().url(),
});

// Devnet + mainnet CAIP-2 chain IDs, mapped from our cluster env.
const CLUSTER_CAIP2: Record<string, string> = {
  devnet: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "mainnet-beta": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
};

// In-flight request tracking. Single-process Map; for multi-instance
// deployments swap to Redis with the same key shape. Keeps two protections:
//
//   1. Idempotency — if a client times out mid-prove (~20s) and retries the
//      same intent, the second call sees the first in `inFlightFingerprints`
//      and returns a clean 409 instead of double-debiting the cap and
//      double-submitting to Umbra.
//   2. Per-agent concurrency cap — bounds how many parallel proves we'll
//      start for one agent. Without this, a misbehaving agent could spin up
//      N concurrent provers and exhaust CPU + RPC connection pools.
//
// The fingerprint deliberately omits time so a fast retry collapses with the
// original. Eviction happens in `finally` blocks below.
const inFlightFingerprints = new Set<string>();
const inFlightPerAgent = new Map<string, number>();
const PER_AGENT_INFLIGHT_LIMIT = 3;

function signFingerprint(
  agentId: string,
  resourceUrl: string,
  requirements: PaymentRequirements,
): string {
  return [
    agentId,
    resourceUrl,
    requirements.amount,
    requirements.payTo,
    requirements.asset,
  ].join("|");
}

export async function POST(req: Request) {
  const ctx = await agentAuthGuard(req);
  if (ctx instanceof Response) return ctx;
  const { agent, budget } = ctx;

  let body: z.infer<typeof SignBody>;
  try {
    body = SignBody.parse(await req.json());
  } catch {
    return apiError("bad_request");
  }

  const requirements = decodePaymentRequirements(body.paymentRequiredHeader);
  if (!requirements) return apiError("invalid_challenge");

  const validation = validateRequirements(requirements);
  if (validation) return apiError("invalid_challenge", validation);

  const amount = BigInt(requirements.amount);

  // Idempotency + concurrency guards BEFORE any DB write. We track a stable
  // fingerprint of the spend intent (no timestamp); a duplicate request from
  // a flaky client collapses on this check. A third unrelated parallel
  // request from the same agent gets rate_limited rather than starting a
  // fourth ZK prove and exhausting CPU.
  const fingerprint = signFingerprint(agent.id, body.resourceUrl, requirements);
  if (inFlightFingerprints.has(fingerprint)) {
    return apiError(
      "conflict",
      "duplicate spend request already in flight; do not retry",
    );
  }
  const currentInFlight = inFlightPerAgent.get(agent.id) ?? 0;
  if (currentInFlight >= PER_AGENT_INFLIGHT_LIMIT) {
    return apiError(
      "rate_limited",
      `agent has ${currentInFlight} spends in flight; max ${PER_AGENT_INFLIGHT_LIMIT}`,
    );
  }
  inFlightFingerprints.add(fingerprint);
  inFlightPerAgent.set(agent.id, currentInFlight + 1);
  try {
    return await performSign({
      agent,
      budget,
      body,
      requirements,
      amount,
    });
  } finally {
    inFlightFingerprints.delete(fingerprint);
    const next = (inFlightPerAgent.get(agent.id) ?? 1) - 1;
    if (next <= 0) inFlightPerAgent.delete(agent.id);
    else inFlightPerAgent.set(agent.id, next);
  }
}

async function performSign(input: {
  agent: { id: string; etaAddress: string };
  budget: { id: string };
  body: z.infer<typeof SignBody>;
  requirements: PaymentRequirements;
  amount: bigint;
}): Promise<Response> {
  const { agent, budget, body, requirements, amount } = input;

  // Lazy period reset (replaces the monthly-cron the schema originally
  // assumed). Idempotent: only touches budgets whose period has elapsed, and
  // concurrent resets converge on the same (spentUsdg=0, periodStart=now).
  await db
    .update(budgets)
    .set({
      spentUsdg: sql`0`,
      periodStart: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(
      sql`${budgets.agentId} = ${agent.id} AND ${budgets.period} = 'monthly' AND now() - ${budgets.periodStart} >= interval '1 month'`,
    );

  // Atomic cap check + increment. Zero rows back means the would-be post-update
  // value exceeds cap_usdg — no TOCTOU window even under concurrency.
  const [updatedBudget] = await db
    .update(budgets)
    .set({ spentUsdg: sql`${budgets.spentUsdg} + ${amount}` })
    .where(
      sql`${budgets.agentId} = ${agent.id} AND ${budgets.spentUsdg} + ${amount} <= ${budgets.capUsdg}`,
    )
    .returning({ id: budgets.id });

  if (!updatedBudget) {
    return apiError("over_cap", `amount ${amount} would exceed monthly cap`);
  }

  // Record the intent as a pending transaction BEFORE the SDK call. If the
  // insert throws, the budget has already been incremented — we MUST
  // compensate or leak money.
  const merchantHost = safeHost(body.resourceUrl);
  let pendingTxId: string;
  try {
    const [row] = await db
      .insert(transactions)
      .values({
        agentId: agent.id,
        kind: "spend",
        direction: "out",
        amountUsdg: amount,
        counterparty: requirements.payTo,
        merchantHost,
        status: "pending",
      })
      .returning({ id: transactions.id });
    if (!row) throw new Error("transactions insert returned no rows");
    pendingTxId = row.id;
  } catch (err) {
    console.error(
      `[x402/sign] pending-tx insert failed for agent=${agent.id}:`,
      err,
    );
    await safeRevertCap(budget.id, amount);
    return apiError("server_error");
  }

  // Hot path: deduct from agent's ETA, drop a UTXO commitment in the mixer
  // tree, addressed to the merchant's ETA. Latency is dominated by Groth16
  // prove (~10–30s) + Arcium MPC callback. SDK retries the transaction
  // forwarder under the hood; if anything escapes here it's a hard failure.
  try {
    const result = await createReceiverClaimableUtxo({
      fromSubject: "agent",
      fromSubjectId: agent.id,
      recipientEtaAddress: requirements.payTo,
      amountMicros: amount,
    });

    const finalized = result.callbackStatus === "finalized";
    await db
      .update(transactions)
      .set({
        queueSignature: result.queueSignature,
        callbackSignature: result.callbackSignature ?? null,
        callbackStatus: result.callbackStatus ?? null,
        // Mirror callback signature to solana_sig so callers that key on
        // solana_sig (e.g. merchant earnings queries) keep working unchanged.
        solanaSig: result.callbackSignature ?? null,
        status: finalized ? "confirmed" : "pending",
        confirmedAt: finalized ? sql`now()` : null,
      })
      .where(eq(transactions.id, pendingTxId));

    // If the MPC callback didn't finalise, the deposit is in an uncertain
    // state: the queue tx already landed (sender's encrypted balance is
    // already debited, or about to be once Arcium completes the MPC), so we
    // CANNOT revert the cap counter without diverging from on-chain truth and
    // letting the agent double-spend. Instead: leave the cap incremented,
    // mark the tx pending with the queue signature for later reconciliation,
    // and refuse to issue the payment header. A reconciliation job (or the
    // operator, manually) decides whether the MPC eventually completed and
    // either confirms or fails the row.
    if (!finalized) {
      console.warn(
        `[x402/sign] tx=${pendingTxId} agent=${agent.id} ` +
          `callbackStatus=${result.callbackStatus ?? "(none)"} ` +
          `queueSig=${result.queueSignature} — refusing to issue payment ` +
          "header; cap remains incremented (on-chain debit may have landed)",
      );
      // Generic message — don't name our infrastructure (Umbra/Arcium MPC)
      // in errors that flow to third-party SDK callers. The detailed reason
      // is in the server log above; the agent-side caller doesn't benefit
      // from the specifics and we don't want to advertise infra to scrapers.
      return apiError(
        "signing_failed",
        "payment is in flight; do not retry until reconciliation completes",
      );
    }

    const paymentSignatureHeader = encodePaymentHeader({
      scheme: "umbra-mixer-v1",
      network: env.NEXT_PUBLIC_SOLANA_CLUSTER,
      asset: requirements.asset,
      amount: requirements.amount,
      recipientEtaAddress: requirements.payTo,
      resource: body.resourceUrl,
      proofSignature: result.createProofAccountSignature,
      queueSignature: result.queueSignature,
      callbackSignature: result.callbackSignature,
    });
    return apiOk({ paymentSignatureHeader });
  } catch (err) {
    console.error(
      `[x402/sign] umbra mixer failed for agent=${agent.id} tx=${pendingTxId}:`,
      err,
    );
    await safeRevertCap(budget.id, amount);
    await safeMarkTxFailed(pendingTxId, err);
    return apiError("signing_failed");
  }
}

/* ─── helpers ────────────────────────────────────────────────────────── */

function decodePaymentRequirements(
  headerB64: string,
): PaymentRequirements | null {
  try {
    const raw = Buffer.from(headerB64, "base64").toString("utf8");
    const parsed = JSON.parse(raw) as PaymentRequired;
    if (!Array.isArray(parsed.accepts) || parsed.accepts.length === 0) {
      return null;
    }

    const expected = CLUSTER_CAIP2[env.NEXT_PUBLIC_SOLANA_CLUSTER];
    const match = parsed.accepts.find((r) => {
      if (r.scheme !== "exact") return false;
      // Requirements from x402-solana v2 merchants emit CAIP-2 format
      // (`solana:<chainId>`). Simple formats ("solana", "solana-devnet") are
      // tolerated as a compatibility fallback — the SDK's client-side
      // `toCAIP2Network` converts them before signing anyway.
      const net = r.network as string;
      return net === expected || net === "solana" || net === "solana-devnet";
    });
    return match ?? null;
  } catch {
    return null;
  }
}

// Lightweight sanity check BEFORE we touch the database. Returns an error
// message string on failure, or null if valid. All pubkey validation happens
// here so malformed merchant input can't reach `new PublicKey(...)` deeper in
// the flow.
function validateRequirements(r: PaymentRequirements): string | null {
  if (r.asset !== env.STABLECOIN_MINT) {
    return "asset mint does not match configured stablecoin";
  }
  if (!isValidPubkey(r.asset)) return "asset is not a valid Solana pubkey";
  if (!r.payTo) return "payTo missing";
  if (!isValidPubkey(r.payTo)) return "payTo is not a valid Solana pubkey";

  let amt: bigint;
  try {
    amt = BigInt(r.amount);
  } catch {
    return "amount is not an integer";
  }
  if (amt <= 0n) return "amount must be positive";
  return null;
}

function isValidPubkey(s: string): boolean {
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}

// Stable JSON envelope for the umbra-mixer payment scheme. The merchant SDK
// decodes this header, fetches `queueSignature` (and `callbackSignature` if
// present) via `getTransaction`, and verifies on-chain that:
//   1. The tx came from a registered Umbra subject
//   2. It targets the merchant's own etaAddress
//   3. The mint matches `asset`
// `amount` is *not* on-chain (it's encrypted); merchants treat it as the
// agent's claim of payment, with the actual credit settling when the claim
// daemon claims the UTXO into the merchant's encrypted balance.
type UmbraPaymentEnvelope = {
  scheme: "umbra-mixer-v1";
  network: string;
  asset: string;
  amount: string;
  recipientEtaAddress: string;
  resource: string;
  proofSignature: string;
  queueSignature: string;
  callbackSignature?: string;
};

function encodePaymentHeader(envelope: UmbraPaymentEnvelope): string {
  return Buffer.from(JSON.stringify(envelope), "utf8").toString("base64");
}

async function safeRevertCap(
  budgetId: string,
  amount: bigint,
): Promise<void> {
  try {
    await db
      .update(budgets)
      .set({ spentUsdg: sql`${budgets.spentUsdg} - ${amount}` })
      .where(eq(budgets.id, budgetId));
  } catch (err) {
    // If this fires, budget.spent_usdg is left ahead of reality. Loud log is
    // the escalation path — the reconciler job can also sweep these by
    // comparing transactions.status='failed' against live budget values.
    console.error(
      `[x402/sign] CRITICAL: revertCap failed for budget=${budgetId} amount=${amount}:`,
      err,
    );
  }
}

async function safeMarkTxFailed(txId: string, err: unknown): Promise<void> {
  try {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(transactions)
      .set({ status: "failed", memo: message.slice(0, 500) })
      .where(eq(transactions.id, txId));
  } catch (dbErr) {
    console.error(
      `[x402/sign] failed to mark tx=${txId} failed (non-critical):`,
      dbErr,
    );
  }
}

function safeHost(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}
