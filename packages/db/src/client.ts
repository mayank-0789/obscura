import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export function createDb(connectionUrl: string) {
  const sql = neon(connectionUrl);
  return drizzle(sql, { schema });
}

export type DB = ReturnType<typeof createDb>;
