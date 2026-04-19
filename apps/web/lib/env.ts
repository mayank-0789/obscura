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
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
    NEXT_PUBLIC_SOLANA_CLUSTER: process.env.NEXT_PUBLIC_SOLANA_CLUSTER,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
