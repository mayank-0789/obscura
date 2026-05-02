import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, budgets, transactions } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api";
import { agentAuthGuard } from "@/lib/agent-auth";
import { env } from "@/lib/env";
import { createReceiverClaimableUtxo, getEncryptedBalance } from "@/lib/umbra";
import { PublicKey } from "@obscura-app/solana";
import type { PaymentRequired, PaymentRequirements } from "x402-solana";
import {
  SOLANA_MAINNET_CAIP2,
  SOLANA_DEVNET_CAIP2,
} from "x402-solana";

const SignBody = z.object({
  paymentRequiredHeader: z.string().min(1),
  resourceUrl: z.string().url(),
});

const CLUSTER_CAIP2: Record<string, string> = {
  devnet: "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1",
  "mainnet-beta": "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
};

// In-flight fingerprint Set + per-agent concurrency cap: idempotency on client
// retry (collapses duplicate spend intent) + bounds CPU/RPC under abuse.
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

  // Lazy period reset (replaces the monthly cron). Idempotent.
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

  // Balance pre-check is racy under concurrent spends — acceptable; worst case is a wasted prove.
  try {
    const balance = await getEncryptedBalance("agent", agent.id);
    const effective = balance ?? 0n;
    if (effective < amount) {
      return apiError(
        "insufficient_funds",
        `agent balance ${effective} < amount ${amount}; top up before retrying`,
      );
    }
  } catch (err) {
    console.warn(
      `[x402/sign] balance pre-check failed for agent=${agent.id} (proceeding):`,
      err,
    );
  }

  // Atomic cap-update + pending-tx insert in one db.transaction: TOCTOU-free,
  // and rollback fires if the tx insert throws (cap can't be left incremented orphan).
  const merchantHost = safeHost(body.resourceUrl);
  let pendingTxId: string;
  try {
    const result = await db.transaction(async (tx) => {
      const [updatedBudget] = await tx
        .update(budgets)
        .set({ spentUsdg: sql`${budgets.spentUsdg} + ${amount}` })
        .where(
          sql`${budgets.agentId} = ${agent.id} AND ${budgets.spentUsdg} + ${amount} <= ${budgets.capUsdg}`,
        )
        .returning({ id: budgets.id });
      if (!updatedBudget) return { kind: "over_cap" as const };

      const [row] = await tx
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
      return { kind: "ok" as const, txId: row.id };
    });

    if (result.kind === "over_cap") {
      return apiError("over_cap", `amount ${amount} would exceed monthly cap`);
    }
    pendingTxId = result.txId;
  } catch (err) {
    console.error(
      `[x402/sign] cap-update + pending-tx insert failed for agent=${agent.id}:`,
      err,
    );
    return apiError("server_error");
  }

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
        solanaSig: result.callbackSignature ?? null,
        status: finalized ? "confirmed" : "pending",
        confirmedAt: finalized ? sql`now()` : null,
      })
      .where(eq(transactions.id, pendingTxId));

    // Callback didn't finalize: the on-chain debit may still land asynchronously, so
    // we leave the cap incremented and refuse to issue the payment header. Reverting
    // the cap while the debit lands would let the agent double-spend.
    if (!finalized) {
      console.warn(
        `[x402/sign] tx=${pendingTxId} agent=${agent.id} ` +
          `callbackStatus=${result.callbackStatus ?? "(none)"} ` +
          `queueSig=${result.queueSignature} — refusing to issue payment ` +
          "header; cap remains incremented (on-chain debit may have landed)",
      );
      // Generic message — don't name infrastructure to SDK callers.
      return apiError(
        "signing_failed",
        "payment is in flight; do not retry until reconciliation completes",
      );
    }

    const paymentSignatureHeader = encodePaymentHeader({
      scheme: "umbra-mixer-v1",
      network: requirements.network,
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
      const net = r.network as string;
      return net === expected || net === "solana" || net === "solana-devnet";
    });
    return match ?? null;
  } catch {
    return null;
  }
}

function validateRequirements(r: PaymentRequirements): string | null {
  if (r.asset !== env.STABLECOIN_MINT) {
    return "asset mint does not match configured stablecoin";
  }
  if (!isValidPubkey(r.asset)) return "asset is not a valid Solana pubkey";
  if (!r.payTo) return "payTo missing";
  if (!isValidPubkey(r.payTo)) return "payTo is not a valid Solana pubkey";

  const expectedSimple =
    env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ? "solana" : "solana-devnet";
  const expectedCaip2 =
    env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta"
      ? SOLANA_MAINNET_CAIP2
      : SOLANA_DEVNET_CAIP2;
  const networkStr = r.network as unknown as string | undefined;
  if (
    networkStr &&
    networkStr !== expectedSimple &&
    networkStr !== expectedCaip2
  ) {
    return `network mismatch: requirements ask for ${networkStr}, this server is on ${expectedSimple}`;
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
    // GREATEST(spent - amount, 0): under contention naive subtraction can drive spent_usdg negative.
    await db
      .update(budgets)
      .set({
        spentUsdg: sql`GREATEST(${budgets.spentUsdg} - ${amount}, 0)`,
      })
      .where(eq(budgets.id, budgetId));
  } catch (err) {
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
