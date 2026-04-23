import { createDb } from "@payrail-app/db";
import { env } from "@/lib/env";

// Drizzle + Neon singleton. Re-exports @payrail-app/db so consumers need one import.
export const db = createDb(env.DATABASE_URL);

export * from "@payrail-app/db";
