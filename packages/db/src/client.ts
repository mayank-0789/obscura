import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export function createDb(connectionUrl: string) {
  const client = postgres(connectionUrl, { prepare: false });
  return drizzle(client, { schema });
}

export type DB = ReturnType<typeof createDb>;
