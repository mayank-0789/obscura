import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, transactions, type Transaction } from "@/lib/db";

/** base64url JSON of `(createdAt, id)`. */
export type AgentTxCursor = { createdAt: string; id: string };

export function encodeAgentTxCursor(c: AgentTxCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export function decodeAgentTxCursor(s: string): AgentTxCursor | null {
  try {
    const raw = Buffer.from(s, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "createdAt" in parsed &&
      "id" in parsed &&
      typeof (parsed as AgentTxCursor).createdAt === "string" &&
      typeof (parsed as AgentTxCursor).id === "string"
    ) {
      return parsed as AgentTxCursor;
    }
    return null;
  } catch {
    return null;
  }
}

/** Confirmed spends by this agent. Tuple-compare keeps ordering stable under rapid inserts. */
export async function getAgentTransactions(input: {
  agentId: string;
  limit: number;
  cursor?: AgentTxCursor;
}): Promise<{ rows: Transaction[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(input.limit, 1), 100);
  const whereClauses = [
    eq(transactions.agentId, input.agentId),
    eq(transactions.kind, "spend"),
    eq(transactions.status, "confirmed"),
  ];
  if (input.cursor) {
    whereClauses.push(
      sql`(${transactions.createdAt}, ${transactions.id}) < (${new Date(input.cursor.createdAt)}, ${input.cursor.id})`,
    );
  }

  const rows = await db
    .select()
    .from(transactions)
    .where(and(...whereClauses))
    .orderBy(desc(transactions.createdAt), desc(transactions.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const trimmed = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = trimmed[trimmed.length - 1];
  const nextCursor =
    hasMore && lastRow
      ? encodeAgentTxCursor({
          createdAt: lastRow.createdAt.toISOString(),
          id: lastRow.id,
        })
      : null;
  return { rows: trimmed, nextCursor };
}
