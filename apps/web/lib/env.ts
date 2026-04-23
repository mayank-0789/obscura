import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Zod-validated env. Server secrets under `server`; browser vars under `client` (NEXT_PUBLIC_ prefix).
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    PRIVY_APP_ID: z.string().min(1),
    PRIVY_APP_SECRET: z.string().min(1),
    // Private half of the delegated-signing keypair. Loaded by the server Privy client.
    PRIVY_AUTHORIZATION_KEY: z.string().optional(),
    // Public ID of the same key — attached to every agent wallet at creation so the
    // server can sign on its behalf without user prompts. Optional while bootstrapping;
    // required before agent wallets can execute x402 payments.
    PRIVY_AUTHORIZATION_KEY_ID: z.string().optional(),
    // Upstash Redis (used for rate limiting). Both must be set to enable; when
    // either is missing, rate limiters short-circuit to "allow" so local dev works
    // without needing an Upstash account.
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
    // Dodo Payments — fiat on-ramp (UPI/card) for agent top-ups.
    DODO_PAYMENTS_API_KEY: z.string().min(1),
    DODO_WEBHOOK_KEY: z.string().min(1),
    DODO_TOPUP_PRODUCT_ID: z.string().min(1),
    DODO_ENVIRONMENT: z.enum(["test_mode", "live_mode"]).default("test_mode"),
    // Helius — Solana RPC for on-chain reads + tx submission.
    HELIUS_RPC_URL: z.string().url(),
    // Helius Enhanced Webhooks — used to push payment-confirmed events to
    // merchant dashboards in real time. All three optional: if any is
    // missing, merchant registration + webhook verification short-circuit
    // to best-effort (dashboards fall back to poll-only updates).
    HELIUS_API_KEY: z.string().optional(),
    HELIUS_WEBHOOK_ID: z.string().optional(),
    HELIUS_WEBHOOK_AUTH_TOKEN: z.string().optional(),
    // Treasury — single raw keypair holding pre-funded USDG. Credits agent
    // wallets on Dodo webhook. Format: JSON array of 64 ints from solana-keygen.
    TREASURY_SECRET_KEY: z.string().min(1),
    TREASURY_PUBLIC_KEY: z.string().min(32).max(44),
    // Stablecoin mint address — swappable (USDC devnet / USDC mainnet / USDG).
    STABLECOIN_MINT: z.string().min(32).max(44),
    // Decimals for STABLECOIN_MINT. USDC + USDG both use 6 on Solana; override
    // via env if we ever onboard a mint with different precision.
    STABLECOIN_DECIMALS: z.coerce.number().int().min(0).max(18).default(6),
    // Shared-secret for operator-only admin endpoints (e.g. Helius reconcile).
    // Optional: when missing, admin endpoints return 503 disabled. Set it to a
    // long random string and scope access via an external cron / curl.
    ADMIN_API_TOKEN: z.string().min(32).optional(),
  },

  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_PRIVY_APP_ID: z.string().min(1),
    NEXT_PUBLIC_SOLANA_CLUSTER: z
      .enum(["mainnet-beta", "devnet"])
      .default("devnet"),
  },

  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    PRIVY_APP_ID: process.env.PRIVY_APP_ID,
    PRIVY_APP_SECRET: process.env.PRIVY_APP_SECRET,
    PRIVY_AUTHORIZATION_KEY: process.env.PRIVY_AUTHORIZATION_KEY,
    PRIVY_AUTHORIZATION_KEY_ID: process.env.PRIVY_AUTHORIZATION_KEY_ID,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    DODO_PAYMENTS_API_KEY: process.env.DODO_PAYMENTS_API_KEY,
    DODO_WEBHOOK_KEY: process.env.DODO_WEBHOOK_KEY,
    DODO_TOPUP_PRODUCT_ID: process.env.DODO_TOPUP_PRODUCT_ID,
    DODO_ENVIRONMENT: process.env.DODO_ENVIRONMENT,
    HELIUS_RPC_URL: process.env.HELIUS_RPC_URL,
    HELIUS_API_KEY: process.env.HELIUS_API_KEY,
    HELIUS_WEBHOOK_ID: process.env.HELIUS_WEBHOOK_ID,
    HELIUS_WEBHOOK_AUTH_TOKEN: process.env.HELIUS_WEBHOOK_AUTH_TOKEN,
    TREASURY_SECRET_KEY: process.env.TREASURY_SECRET_KEY,
    TREASURY_PUBLIC_KEY: process.env.TREASURY_PUBLIC_KEY,
    STABLECOIN_MINT: process.env.STABLECOIN_MINT,
    STABLECOIN_DECIMALS: process.env.STABLECOIN_DECIMALS,
    ADMIN_API_TOKEN: process.env.ADMIN_API_TOKEN,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
    NEXT_PUBLIC_SOLANA_CLUSTER: process.env.NEXT_PUBLIC_SOLANA_CLUSTER,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});

// Delegated signing requires BOTH the private key and the key ID. Setting only
// one silently breaks agent-wallet signing at x402 time. Fail loudly at boot
// instead — but only on the server, and only when env validation wasn't
// explicitly skipped (e.g. during `next build` in CI without secrets).
if (
  typeof window === "undefined" &&
  !process.env.SKIP_ENV_VALIDATION
) {
  const hasKey = !!process.env.PRIVY_AUTHORIZATION_KEY;
  const hasId = !!process.env.PRIVY_AUTHORIZATION_KEY_ID;
  if (hasKey !== hasId) {
    throw new Error(
      "env: PRIVY_AUTHORIZATION_KEY and PRIVY_AUTHORIZATION_KEY_ID must both be set or both be absent.",
    );
  }
}
