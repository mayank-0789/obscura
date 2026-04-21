// POST /api/x402/sign — the heart of Payrail's agent-spending loop.
//
// Called by @payrail/sdk when an agent's fetch() receives a 402 from a paid
// API. The SDK forwards the PAYMENT-REQUIRED header (base64 JSON from the
// merchant) + the original URL; we authenticate the caller via the agent's
// API key, enforce the monthly spend cap, build the Solana payment
// transaction, sign it via Privy delegated signing, and hand back the
// PAYMENT-SIGNATURE header that the SDK will put on the retried request.
//
// Auth model: Bearer <agent-api-key>. Separate from user-JWT routes — the
// caller here is an agent's process, not a human with a session.
//
// Atomicity: the cap check + spend-increment run as a single UPDATE WHERE
// RETURNING. Zero rows back = over cap. This is the only race-safe pattern;
// a read-then-write would let concurrent signs blow through the cap.
//
// What this route does NOT do: broadcast the tx. We only sign. The signed tx
// rides back to the merchant in the PAYMENT-SIGNATURE header, the merchant
// forwards it to the PayAI facilitator, and the facilitator broadcasts +
// settles. Consequence: we increment spent_usdg optimistically; in the rare
// case the merchant/facilitator fails to settle, the spent counter is ahead
// of the real on-chain debit. A reconciler cron (v2) will scan pending
// transactions and decrement the counter if the tx never lands.

import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, budgets, transactions } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api";
import { agentAuthGuard } from "@/lib/agent-auth";
import { privy } from "@/lib/privy-server";
import { env } from "@/lib/env";
import { getConnection } from "@/lib/solana";
import { buildUnsignedX402PaymentTx } from "@/lib/x402-tx";
import { PublicKey } from "@payrail/solana";
import { createPaymentPayload } from "x402-solana";
import type { PaymentRequired, PaymentRequirements } from "x402-solana";
import type { VersionedTransaction } from "@solana/web3.js";

const SignBody = z.object({
  // base64-encoded JSON of PaymentRequired from the merchant's 402 response.
  paymentRequiredHeader: z.string().min(1),
  // Original URL the agent tried to GET — used for display/auditing + the
  // PaymentPayload's resource field (x402 v2 spec).
  resourceUrl: z.string().url(),
});

// Devnet + mainnet CAIP-2 chain IDs, mapped from our cluster env.
const CLUSTER_CAIP2: Record<string, string> = {
  devnet: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "mainnet-beta": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
};

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

  // Atomic cap check + increment. Zero rows back means the would-be post-update
  // value exceeds cap_usdg — no TOCTOU window even under concurrency.
  //
  // We use update().returning() + insert().returning() as two separate
  // statements rather than db.batch() because the cap check must stand alone
  // (succeed or fail atomically) and the pending-row insert is a pure write
  // that doesn't depend on further data from the update. Wrapping both in a
  // batch would add a round-trip without buying correctness.
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

  // Record the intent as a pending transaction BEFORE signing. If the insert
  // throws, the budget has already been incremented — we MUST compensate or
  // leak money. safeDbOp makes revertCap failures loud but non-blocking.
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

  // Build + sign. Any failure past this point reverts the cap and marks the
  // transactions row failed, so budget.spent_usdg stays consistent with
  // reality even if the sign throws.
  try {
    const signedTx = await buildAndSignPaymentTx(
      new PublicKey(agent.publicKey),
      agent.privyWalletId,
      requirements,
    );
    const paymentSignatureHeader = createPaymentPayload(
      signedTx,
      requirements,
      body.resourceUrl,
    );
    return apiOk({ paymentSignatureHeader });
  } catch (err) {
    // Log the real error server-side; do NOT leak err.message to the caller —
    // Privy errors can contain wallet IDs, app IDs, and stack fragments.
    console.error(
      `[x402/sign] sign failed for agent=${agent.id} tx=${pendingTxId}:`,
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
// here so malformed merchant input can't reach `new PublicKey(...)` where it
// would surface as a generic "Non-base58 character" deeper in the flow.
function validateRequirements(r: PaymentRequirements): string | null {
  if (r.asset !== env.STABLECOIN_MINT) {
    return "asset mint does not match configured stablecoin";
  }
  if (!isValidPubkey(r.asset)) return "asset is not a valid Solana pubkey";
  if (!r.payTo) return "payTo missing";
  if (!isValidPubkey(r.payTo)) return "payTo is not a valid Solana pubkey";

  const feePayer = r.extra?.feePayer;
  if (!feePayer || typeof feePayer !== "string") {
    return "extra.feePayer missing (facilitator)";
  }
  if (!isValidPubkey(feePayer)) {
    return "extra.feePayer is not a valid Solana pubkey";
  }

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

async function buildAndSignPaymentTx(
  agentPubkey: PublicKey,
  privyWalletId: string,
  requirements: PaymentRequirements,
): Promise<VersionedTransaction> {
  const connection = getConnection();

  const unsigned = await buildUnsignedX402PaymentTx({
    connection,
    agentPubkey,
    requirements,
  });

  const { signedTransaction } = await privy.walletApi.solana.signTransaction({
    walletId: privyWalletId,
    transaction: unsigned,
  });

  // Privy's SDK returns `Transaction | VersionedTransaction`; we passed in v0
  // so we should receive v0 back. Defensive narrowing also verifies a real
  // signature was produced — a return value without signatures would mean the
  // sign call silently no-op'd (shouldn't happen with delegated keys, but
  // guard against SDK regressions and mis-configuration).
  if (!signedTransaction || !("version" in signedTransaction)) {
    throw new Error(
      "Privy returned unexpected signed-transaction shape (not a VersionedTransaction)",
    );
  }
  if (
    !Array.isArray(signedTransaction.signatures) ||
    signedTransaction.signatures.length === 0
  ) {
    throw new Error("Privy returned a VersionedTransaction without signatures");
  }
  return signedTransaction;
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
