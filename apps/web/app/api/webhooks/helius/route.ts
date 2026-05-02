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
import { checkLimit } from "@/lib/ratelimit";
import { getConnection } from "@/lib/solana";

// Pin to nodejs — the in-process eventBroker singleton is process-pinned, so
// flipping to edge would silently break realtime SSE updates.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONFIRM_WINDOW_MINUTES = 60; // don't auto-confirm orphan pending rows older than this

// Pre-filter malformed signatures before any RPC/DB write — leaked-token defense.
const SOLANA_SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;

const TokenTransferSchema = z.object({
  mint: z.string(),
  tokenAmount: z.number().optional(),
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

const MAX_EVENTS_PER_BATCH = 100;

const BodySchema = z
  .array(EventSchema)
  .max(MAX_EVENTS_PER_BATCH);

// Decline idempotency on no-match within this window so Helius retries us
// rather than wedging on a sign-route INSERT race.
const PENDING_RACE_WINDOW_SECONDS = 120;

export async function POST(req: Request) {
  if (!verifyAuth(req)) {
    return new Response(null, { status: 401 });
  }

  const sourceIp =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "0.0.0.0";
  const ok = await checkLimit("helius-webhook", sourceIp, 600, "1 m");
  if (!ok) {
    console.warn(`[helius-webhook] rate-limited source=${sourceIp}`);
    return new Response(null, { status: 429 });
  }

  let events: z.infer<typeof BodySchema>;
  try {
    events = BodySchema.parse(await req.json());
  } catch {
    console.error("[helius-webhook] malformed body");
    return new Response(null, { status: 400 });
  }

  let processed = 0;
  let skipped = 0;
  let retryNeeded = false;

  for (const event of events) {
    try {
      const outcome = await handleEvent(event);
      if (outcome === "processed") processed += 1;
      else if (outcome === "retry") retryNeeded = true;
      else skipped += 1;
    } catch (err) {
      console.error(
        `[helius-webhook] event ${event.signature} failed:`,
        err,
      );
      skipped += 1;
    }
  }

  if (retryNeeded && processed === 0) {
    return new Response(
      JSON.stringify({ status: "retry", reason: "pending_match_race_window" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  return Response.json({ processed, skipped });
}

function verifyAuth(req: Request): boolean {
  const expected = env.HELIUS_WEBHOOK_AUTH_TOKEN;
  if (!expected) {
    console.warn(
      "[helius-webhook] HELIUS_WEBHOOK_AUTH_TOKEN not set; rejecting all inbound",
    );
    return false;
  }
  const received = req.headers.get("authorization");
  if (!received) return false;

  const expDigest = createHash("sha256").update(expected).digest();
  const recvDigest = createHash("sha256").update(received).digest();
  return timingSafeEqual(expDigest, recvDigest);
}

type HandleOutcome = "processed" | "skipped" | "retry";

async function handleEvent(
  event: z.infer<typeof EventSchema>,
): Promise<HandleOutcome> {
  const transfers = event.tokenTransfers ?? [];
  const stablecoinTransfers = transfers.filter(
    (t) => t.mint === env.STABLECOIN_MINT,
  );
  if (stablecoinTransfers.length === 0) return "skipped";

  if (!SOLANA_SIG_RE.test(event.signature)) {
    console.warn(
      `[helius-webhook] rejecting event with malformed signature: ${event.signature.slice(0, 20)}…`,
    );
    return "skipped";
  }

  // On-chain re-verify: even with a leaked auth token, an attacker cannot forge a Solana signature.
  const onchainOk = await verifySignatureOnChain(event.signature);
  if (!onchainOk) {
    console.warn(
      `[helius-webhook] signature not confirmed on-chain: ${event.signature.slice(0, 12)}…`,
    );
    return "skipped";
  }

  const existing = await db
    .select({ id: webhookLog.id })
    .from(webhookLog)
    .where(
      and(
        eq(webhookLog.provider, "helius"),
        eq(webhookLog.eventId, event.signature),
      ),
    )
    .limit(1);
  if (existing.length > 0) return "skipped";

  let matched = 0;
  for (const transfer of stablecoinTransfers) {
    if (await confirmPendingTx(event.signature, transfer)) matched += 1;
  }

  // Inside the race window with no match → decline idempotency so Helius retries
  // (closes the race where on-chain confirmation lands before sign-route INSERT commits).
  const eventAgeSeconds = event.timestamp
    ? Math.max(0, Math.floor(Date.now() / 1000) - event.timestamp)
    : Number.MAX_SAFE_INTEGER;
  if (matched === 0 && eventAgeSeconds < PENDING_RACE_WINDOW_SECONDS) {
    console.warn(
      `[helius-webhook] no pending match yet for sig=${event.signature.slice(0, 12)}…; ` +
        `eventAge=${eventAgeSeconds}s < ${PENDING_RACE_WINDOW_SECONDS}s — declining idempotency to allow retry`,
    );
    return "retry";
  }

  await db
    .insert(webhookLog)
    .values({
      provider: "helius",
      eventId: event.signature,
      payload: event,
      processedAt: new Date(),
    })
    .onConflictDoNothing({
      target: [webhookLog.provider, webhookLog.eventId],
    });

  return matched > 0 ? "processed" : "skipped";
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
): Promise<boolean> {
  if (!transfer.toUserAccount || !transfer.fromUserAccount) return false;

  const amount = extractAtomicAmount(transfer);
  if (amount === null) return false;

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
    return false;
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
  if (!updated) return false;

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
  return true;
}

function extractAtomicAmount(
  transfer: z.infer<typeof TokenTransferSchema>,
): bigint | null {
  if (transfer.rawTokenAmount) {
    try {
      return BigInt(transfer.rawTokenAmount.tokenAmount);
    } catch {
      return null;
    }
  }
  if (typeof transfer.tokenAmount === "number") {
    // Math.round (not floor) — IEEE-754 scaling can land at .999… and silently miss the match.
    const scale = 10 ** env.STABLECOIN_DECIMALS;
    return BigInt(Math.round(transfer.tokenAmount * scale));
  }
  return null;
}
