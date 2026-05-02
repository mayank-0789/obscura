import { createDb } from "@obscura-app/db";
import { env } from "@/lib/env";

export const db = createDb(env.DATABASE_URL);

export * from "@obscura-app/db";
