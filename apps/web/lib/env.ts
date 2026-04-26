import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Zod-validated env. Server secrets under `server`; browser vars under `client` (NEXT_PUBLIC_ prefix).
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    // Auth.js (NextAuth v5). AUTH_SECRET signs the session cookie + JWT.
    // Generate via `openssl rand -base64 32`.
    AUTH_SECRET: z.string().min(32),
    // Optional canonical URL — Auth.js infers from Vercel/Next env when unset.
    AUTH_URL: z.string().url().optional(),
    // Google OAuth credentials — console.cloud.google.com → APIs & Services → Credentials.
    AUTH_GOOGLE_ID: z.string().min(1),
    AUTH_GOOGLE_SECRET: z.string().min(1),
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
    // Umbra Privacy SDK — server-derived seed material. Used to deterministically
    // derive every agent + merchant Umbra keypair via HMAC. Lose this and every
    // encrypted balance is unrecoverable. Required.
    UMBRA_AGENT_SEED_SECRET: z.string().min(32),
    UMBRA_NETWORK: z.enum(["devnet", "mainnet", "localnet"]).default("devnet"),
    // Override only when the WS endpoint diverges from HELIUS_RPC_URL (rare).
    UMBRA_RPC_SUBSCRIPTIONS_URL: z.string().url().optional(),
    // Umbra hosted services — required for the mixer (UTXO scan + claim relay).
    // Direct deposit/withdraw paths don't need these, so they're optional in env
    // and code paths that need them assert presence at call time.
    UMBRA_INDEXER_URL: z.string().url().optional(),
    UMBRA_RELAYER_URL: z.string().url().optional(),
  },

  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_SOLANA_CLUSTER: z
      .enum(["mainnet-beta", "devnet"])
      .default("devnet"),
  },

  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
    AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
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
    UMBRA_AGENT_SEED_SECRET: process.env.UMBRA_AGENT_SEED_SECRET,
    UMBRA_NETWORK: process.env.UMBRA_NETWORK,
    UMBRA_RPC_SUBSCRIPTIONS_URL: process.env.UMBRA_RPC_SUBSCRIPTIONS_URL,
    UMBRA_INDEXER_URL: process.env.UMBRA_INDEXER_URL,
    UMBRA_RELAYER_URL: process.env.UMBRA_RELAYER_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SOLANA_CLUSTER: process.env.NEXT_PUBLIC_SOLANA_CLUSTER,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
