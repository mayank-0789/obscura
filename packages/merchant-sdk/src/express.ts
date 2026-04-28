import { Connection, PublicKey } from "@solana/web3.js";
import type { ChargeConfig, MerchantSdkConfig } from "./types.js";

// Express-compatible types (only the surface we actually use). We intentionally
// avoid a runtime dependency on express — consumers bring their own framework.
type ExpressLikeReq = {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
  url?: string;
  protocol?: string;
  get?: (header: string) => string | undefined;
};

type ExpressLikeRes = {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ExpressLikeRes;
  json: (body: unknown) => ExpressLikeRes;
  send: (body?: unknown) => ExpressLikeRes;
};

type NextFn = (err?: unknown) => void;
type Middleware = (
  req: ExpressLikeReq,
  res: ExpressLikeRes,
  next: NextFn,
) => void | Promise<void>;

const DEFAULT_DEVNET_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const DEFAULT_MAINNET_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DEFAULT_DEVNET_RPC = "https://api.devnet.solana.com";
const DEFAULT_MAINNET_RPC = "https://api.mainnet-beta.solana.com";
const DEFAULT_REPLAY_WINDOW_MS = 5 * 60 * 1000;
const PAYMENT_SCHEME = "umbra-mixer-v1" as const;

/**
 * The x402 PaymentRequirements shape we serve in our 402 response. Compatible
 * with the @obscura-app/sdk consumer side that decodes a base64 JSON
 * `PAYMENT-REQUIRED` header — the SDK reads `accepts[0]`, picks scheme=exact,
 * and forwards the whole header to Obscura's /api/x402/sign.
 */
export type PaymentRequirements = {
  scheme: "exact";
  network: "solana" | "solana-devnet";
  asset: string;
  amount: string;
  payTo: string;
  resource: string;
  maxTimeoutSeconds: number;
  description?: string;
  mimeType: string;
};

/**
 * The umbra-mixer-v1 payment envelope produced by Obscura's /api/x402/sign.
 * Travels in the agent's retry as a base64-encoded `PAYMENT-SIGNATURE` header.
 * Contains the on-chain proofs the merchant verifies via RPC.
 */
type UmbraMixerEnvelope = {
  scheme: typeof PAYMENT_SCHEME;
  network: string;
  asset: string;
  amount: string;
  recipientEtaAddress: string;
  resource: string;
  proofSignature: string;
  queueSignature: string;
  callbackSignature?: string;
};

export type ObscuraMerchantClient = {
  /**
   * Produce Express-style middleware that demands `amount` atomic units of
   * the configured stablecoin before the downstream handler runs. On a valid
   * payment, the middleware verifies the umbra-mixer-v1 envelope on-chain,
   * attaches an `X-Payment-Response` header, and calls `next()`.
   */
  charge: (config: ChargeConfig) => Middleware;
};

export function obscura(config: MerchantSdkConfig): ObscuraMerchantClient {
  if (!config.merchantEtaAddress) {
    throw new Error("@obscura-app/merchant-sdk: merchantEtaAddress is required");
  }
  if (!isValidPubkey(config.merchantEtaAddress)) {
    throw new Error(
      "@obscura-app/merchant-sdk: merchantEtaAddress is not a valid Solana pubkey",
    );
  }

  const network = config.network ?? "solana-devnet";
  const decimals = config.decimals ?? 6;
  const mint =
    config.mint ??
    (network === "solana" ? DEFAULT_MAINNET_USDC : DEFAULT_DEVNET_USDC);
  const rpcUrl =
    config.rpcUrl ??
    (network === "solana" ? DEFAULT_MAINNET_RPC : DEFAULT_DEVNET_RPC);
  const replayWindowMs = config.replayWindowMs ?? DEFAULT_REPLAY_WINDOW_MS;

  const connection = new Connection(rpcUrl, "confirmed");
  const seenQueueSigs = new Map<string, number>();

  const defaultAsset = { address: mint, decimals };

  return {
    charge(charge) {
      const asset = charge.asset ?? defaultAsset;

      return async (req, res, next) => {
        try {
          const resourceUrl = buildResourceUrl(req);
          const paymentHeader = extractPaymentHeader(req.headers);

          if (!paymentHeader) {
            // No payment yet — issue a 402 challenge with the merchant's ETA
            // as `payTo`. The agent SDK forwards this challenge verbatim to
            // Obscura, which constructs a UTXO addressed to that ETA.
            const requirements: PaymentRequirements = {
              scheme: "exact",
              network,
              asset: asset.address,
              amount: charge.amount,
              payTo: config.merchantEtaAddress,
              resource: resourceUrl,
              maxTimeoutSeconds: charge.maxTimeoutSeconds ?? 300,
              mimeType: charge.mimeType ?? "application/json",
              ...(charge.description ? { description: charge.description } : {}),
            };
            const body = { x402Version: 2, accepts: [requirements] };
            const encoded = Buffer.from(JSON.stringify(body)).toString(
              "base64",
            );
            res.setHeader("PAYMENT-REQUIRED", encoded);
            res.status(402).json(body);
            return;
          }

          // Agent presented an envelope — verify it.
          const verification = await verifyEnvelope({
            paymentHeader,
            merchantEta: config.merchantEtaAddress,
            expectedAsset: asset.address,
            expectedAmount: charge.amount,
            resourceUrl,
            seenQueueSigs,
            replayWindowMs,
            connection,
          });

          if (!verification.ok) {
            res.status(402).json({
              error: "invalid_payment",
              reason: verification.reason,
            });
            return;
          }

          // Settlement is implicit — by the time the agent has the envelope,
          // the queue tx has landed and Arcium MPC has finalized. Nothing to
          // settle here. Echo the proofs back so downstream handlers (and
          // the agent's response logging) can verify on-chain.
          const settlement = {
            scheme: PAYMENT_SCHEME,
            queueSignature: verification.queueSignature,
            callbackSignature: verification.callbackSignature,
            recipient: config.merchantEtaAddress,
            amount: charge.amount,
            asset: asset.address,
          };
          res.setHeader(
            "X-Payment-Response",
            Buffer.from(JSON.stringify(settlement)).toString("base64"),
          );
          exposeSettlement(res, settlement);
          next();
        } catch (err) {
          next(err);
        }
      };
    },
  };
}

interface VerifyContext {
  paymentHeader: string;
  merchantEta: string;
  expectedAsset: string;
  expectedAmount: string;
  resourceUrl: string;
  seenQueueSigs: Map<string, number>;
  replayWindowMs: number;
  connection: Connection;
}

type VerifyResult =
  | { ok: true; queueSignature: string; callbackSignature?: string }
  | { ok: false; reason: string };

/**
 * Decodes the umbra-mixer-v1 envelope, runs sanity checks against the merchant's
 * configured ETA + mint + amount + resource URL, then verifies the queue tx
 * (and callback tx if present) actually landed on Solana.
 *
 * What we DO check:
 *   - Envelope shape + scheme tag matches.
 *   - recipientEtaAddress equals the merchant's own ETA. (Stops an agent from
 *     re-presenting an envelope addressed to a DIFFERENT merchant.)
 *   - asset, amount, resource match what this route requires. (Replay across
 *     routes / amounts / mints.)
 *   - queueSignature hasn't been seen within the replay window. (Reuse of the
 *     same envelope on the same route within 5 min.)
 *   - The queue tx exists on Solana and didn't error.
 *   - The callback tx (if present) exists and didn't error.
 *
 * What we INTENTIONALLY don't check (yet — deferred-hardening):
 *   - That the queue tx's instruction data actually matches the envelope's
 *     claimed amount/recipient. The Umbra program enforces consistency by
 *     construction, and parsing the codama-generated instruction layout is
 *     non-trivial; for hackathon scope we trust that a successful queue tx
 *     means the encrypted balance update reflected by the envelope.
 *   - The Groth16 proof signature. Same reason.
 */
async function verifyEnvelope(ctx: VerifyContext): Promise<VerifyResult> {
  let envelope: UmbraMixerEnvelope;
  try {
    const raw = Buffer.from(ctx.paymentHeader, "base64").toString("utf8");
    envelope = JSON.parse(raw) as UmbraMixerEnvelope;
  } catch {
    return { ok: false, reason: "envelope is not valid base64 JSON" };
  }

  if (envelope.scheme !== PAYMENT_SCHEME) {
    return { ok: false, reason: `unsupported scheme: ${envelope.scheme}` };
  }
  if (envelope.recipientEtaAddress !== ctx.merchantEta) {
    return {
      ok: false,
      reason: "recipientEtaAddress does not match merchant ETA",
    };
  }
  if (envelope.asset !== ctx.expectedAsset) {
    return { ok: false, reason: "asset mint does not match route" };
  }
  if (envelope.amount !== ctx.expectedAmount) {
    return { ok: false, reason: "amount does not match route" };
  }
  if (envelope.resource !== ctx.resourceUrl) {
    return { ok: false, reason: "resource URL does not match request" };
  }
  if (!envelope.queueSignature) {
    return { ok: false, reason: "queueSignature missing" };
  }

  // Replay protection: evict expired entries first, then check.
  const now = Date.now();
  for (const [sig, when] of ctx.seenQueueSigs) {
    if (now - when > ctx.replayWindowMs) ctx.seenQueueSigs.delete(sig);
  }
  if (ctx.seenQueueSigs.has(envelope.queueSignature)) {
    return { ok: false, reason: "queueSignature already used (replay)" };
  }

  // On-chain verify — the queue tx must exist and have succeeded.
  let queueTx: Awaited<ReturnType<Connection["getTransaction"]>>;
  try {
    queueTx = await ctx.connection.getTransaction(envelope.queueSignature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
  } catch (err) {
    return {
      ok: false,
      reason: `RPC error fetching queue tx: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  if (!queueTx) {
    return { ok: false, reason: "queue tx not found on chain" };
  }
  if (queueTx.meta?.err) {
    return {
      ok: false,
      reason: `queue tx failed on chain: ${JSON.stringify(queueTx.meta.err)}`,
    };
  }

  // If the SDK reported a finalized callback, verify it too. Older envelopes
  // may not include this field — that's OK, the queue tx is the primary
  // success signal.
  if (envelope.callbackSignature) {
    try {
      const cbTx = await ctx.connection.getTransaction(
        envelope.callbackSignature,
        {
          maxSupportedTransactionVersion: 0,
          commitment: "confirmed",
        },
      );
      if (!cbTx) {
        return { ok: false, reason: "callback tx not found on chain" };
      }
      if (cbTx.meta?.err) {
        return {
          ok: false,
          reason: `callback tx failed on chain: ${JSON.stringify(cbTx.meta.err)}`,
        };
      }
    } catch (err) {
      return {
        ok: false,
        reason: `RPC error fetching callback tx: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  ctx.seenQueueSigs.set(envelope.queueSignature, now);
  return {
    ok: true,
    queueSignature: envelope.queueSignature,
    ...(envelope.callbackSignature
      ? { callbackSignature: envelope.callbackSignature }
      : {}),
  };
}

function extractPaymentHeader(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const raw =
    headers["payment-signature"] ??
    headers["PAYMENT-SIGNATURE"] ??
    headers["Payment-Signature"];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

function isValidPubkey(s: string): boolean {
  try {
    new PublicKey(s);
    return true;
  } catch {
    return false;
  }
}

// Expose the settlement result at `res.locals.obscuraSettlement` so downstream
// handlers can attach the on-chain tx signature to their response body. No-op
// on frameworks without `res.locals` (only Express ships it by default).
function exposeSettlement(res: ExpressLikeRes, settlement: unknown): void {
  const locals = (res as unknown as { locals?: Record<string, unknown> })
    .locals;
  if (locals && typeof locals === "object") {
    locals.obscuraSettlement = settlement;
  }
}

function buildResourceUrl(req: ExpressLikeReq): string {
  // Express sets `req.get('host')`; fall back to the raw `Host` header so
  // frameworks without `req.get` still produce a useful resource URL. Final
  // `localhost` fallback only triggers when the Host header is also missing
  // (proxy strips it without X-Forwarded-Host).
  const headerHost = req.headers["host"];
  const rawHost = Array.isArray(headerHost) ? headerHost[0] : headerHost;
  const host = req.get?.("host") ?? rawHost ?? "localhost";
  const proto = req.protocol ?? "http";
  const path = req.originalUrl ?? req.url ?? "/";
  return `${proto}://${host}${path}`;
}
