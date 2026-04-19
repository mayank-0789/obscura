import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

// Zod-validated env. Server secrets under `server`; browser vars under `client` (NEXT_PUBLIC_ prefix).
export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    PRIVY_APP_ID: z.string().min(1),
    PRIVY_APP_SECRET: z.string().min(1),
    // Optional until delegated signing ships (Day 4+).
    PRIVY_AUTHORIZATION_KEY: z.string().optional(),
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
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_PRIVY_APP_ID: process.env.NEXT_PUBLIC_PRIVY_APP_ID,
    NEXT_PUBLIC_SOLANA_CLUSTER: process.env.NEXT_PUBLIC_SOLANA_CLUSTER,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
