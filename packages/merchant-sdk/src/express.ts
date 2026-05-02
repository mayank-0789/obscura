import { Connection, PublicKey } from "@solana/web3.js";
import type { ChargeConfig, MerchantSdkConfig } from "./types.js";

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

          const verification = await verifyEnvelope({
            paymentHeader,
            merchantEta: config.merchantEtaAddress,
            expectedAsset: asset.address,
            expectedAmount: charge.amount,
            expectedNetwork: network,
            resourceUrl,
            seenQueueSigs,
            replayWindowMs,
            connection,
          });

          if (!verification.ok) {
            // 400, NOT 402: agent already paid and produced a bad envelope.
            // Returning 402 would falsely tell the agent SDK "pay again".
            res.status(400).json({
              error: "invalid_payment",
              reason: verification.reason,
            });
            return;
          }

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
  expectedNetwork: PaymentRequirements["network"];
  resourceUrl: string;
  seenQueueSigs: Map<string, number>;
  replayWindowMs: number;
  connection: Connection;
}

type VerifyResult =
  | { ok: true; queueSignature: string; callbackSignature?: string }
  | { ok: false; reason: string };

// Verifies the umbra-mixer-v1 envelope against route config + on-chain state.
// We do NOT parse the codama instruction layout — the Umbra program enforces
// consistency by construction; deferred-hardening for v2.
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
  if (envelope.network !== ctx.expectedNetwork) {
    return {
      ok: false,
      reason: `network mismatch: envelope is ${envelope.network}, route expects ${ctx.expectedNetwork}`,
    };
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

  const now = Date.now();
  for (const [sig, when] of ctx.seenQueueSigs) {
    if (now - when > ctx.replayWindowMs) ctx.seenQueueSigs.delete(sig);
  }
  if (ctx.seenQueueSigs.has(envelope.queueSignature)) {
    return { ok: false, reason: "queueSignature already used (replay)" };
  }

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

function exposeSettlement(res: ExpressLikeRes, settlement: unknown): void {
  const locals = (res as unknown as { locals?: Record<string, unknown> })
    .locals;
  if (locals && typeof locals === "object") {
    locals.obscuraSettlement = settlement;
  }
}

function buildResourceUrl(req: ExpressLikeReq): string {
  const headerHost = req.headers["host"];
  const rawHost = Array.isArray(headerHost) ? headerHost[0] : headerHost;
  const host = req.get?.("host") ?? rawHost ?? "localhost";
  const proto = req.protocol ?? "http";
  const path = req.originalUrl ?? req.url ?? "/";
  return `${proto}://${host}${path}`;
}
