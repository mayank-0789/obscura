import { createDb } from "@obscura-app/db";
import { env } from "@/lib/env";

// Drizzle + Neon singleton. Re-exports @obscura-app/db so consumers need one import.
export const db = createDb(env.DATABASE_URL);

export * from "@obscura-app/db";
