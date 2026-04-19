import { createDb } from "@payrail/db";
import { env } from "@/lib/env";

// Drizzle + Neon singleton. Re-exports @payrail/db so consumers need one import.
export const db = createDb(env.DATABASE_URL);

export * from "@payrail/db";
