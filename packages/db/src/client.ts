import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Factory — apps pass in their own env-validated DATABASE_URL. Keeps this package env-free.
export function createDb(connectionUrl: string) {
  const sql = neon(connectionUrl);
  return drizzle(sql, { schema });
}

export type DB = ReturnType<typeof createDb>;
