import {
  X402PaymentHandler,
  type PaymentRequirements,
  type RouteConfig,
} from "x402-solana";
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

const DEFAULT_FACILITATOR = "https://facilitator.payai.network";
const DEFAULT_DEVNET_USDC = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const DEFAULT_MAINNET_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type PayrailMerchantClient = {
  /**
   * Produce Express-style middleware that demands `amount` atomic units of
   * the configured stablecoin before the downstream handler runs. On a valid
   * payment, the middleware verifies + settles via the facilitator, attaches
   * an `X-Payment-Response` header to the response, and calls `next()`.
   */
  charge: (config: ChargeConfig) => Middleware;
};

export function payrail(config: MerchantSdkConfig): PayrailMerchantClient {
  if (!config.payoutWallet) {
    throw new Error("@payrail/merchant-sdk: payoutWallet is required");
  }

  const network = config.network ?? "solana-devnet";
  const decimals = config.decimals ?? 6;
  const mint =
    config.mint ??
    (network === "solana" ? DEFAULT_MAINNET_USDC : DEFAULT_DEVNET_USDC);

  // X402PaymentHandler accepts undefined for the optional fields — no need to
  // conditional-spread.
  const handler = new X402PaymentHandler({
    network,
    treasuryAddress: config.payoutWallet,
    facilitatorUrl: config.facilitatorUrl ?? DEFAULT_FACILITATOR,
    rpcUrl: config.rpcUrl,
    apiKeyId: config.apiKeyId,
    apiKeySecret: config.apiKeySecret,
  });

  const defaultAsset = { address: mint, decimals };

  return {
    charge(charge) {
      const routeConfig: RouteConfig = {
        amount: charge.amount,
        asset: charge.asset ?? defaultAsset,
        description: charge.description,
        mimeType: charge.mimeType,
        maxTimeoutSeconds: charge.maxTimeoutSeconds,
      };

      return async (req, res, next) => {
        try {
          const resourceUrl = buildResourceUrl(req);
          const paymentHeader = handler.extractPayment(req.headers);

          // One `createPaymentRequirements` call serves both the 402 response
          // path AND the verify/settle path. It hits the facilitator's
          // /supported endpoint (200–500ms), so deduplicating saves a full
          // round-trip on every paid request.
          const requirements = await handler.createPaymentRequirements(
            routeConfig,
            resourceUrl,
          );

          if (!paymentHeader) {
            const { body } = handler.create402Response(
              requirements,
              resourceUrl,
            );
            const encoded = Buffer.from(JSON.stringify(body)).toString(
              "base64",
            );
            res.setHeader("PAYMENT-REQUIRED", encoded);
            res.status(402).json(body);
            return;
          }

          const verification = await handler.verifyPayment(
            paymentHeader,
            requirements,
          );
          if (!verification.isValid) {
            res.status(402).json({
              error: "invalid_payment",
              reason: verification.invalidReason,
            });
            return;
          }

          // Settle BEFORE handing off to the downstream handler. The x402
          // spec permits settle-after-handler, but synchronous settle gives
          // us a real tx signature in time to attach X-Payment-Response.
          // Latency cost: ~300–600ms of facilitator round-trip.
          const settlement = await handler.settlePayment(
            paymentHeader,
            requirements,
          );
          if (!settlement.success) {
            res.status(402).json({
              error: "settle_failed",
              reason: settlement.errorReason,
            });
            return;
          }

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

// Expose the settlement result at `res.locals.payrailSettlement` so downstream
// handlers can attach the on-chain tx signature to their response body. No-op
// on frameworks without `res.locals` (only Express ships it by default).
function exposeSettlement(res: ExpressLikeRes, settlement: unknown): void {
  const locals = (res as unknown as { locals?: Record<string, unknown> })
    .locals;
  if (locals && typeof locals === "object") {
    locals.payrailSettlement = settlement;
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

// Re-export the x402-solana requirements type so consumers can strongly-type
// any handler that reads payment details from res.locals.
export type { PaymentRequirements };
