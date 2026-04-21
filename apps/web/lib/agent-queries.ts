import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, transactions, type Transaction } from "@/lib/db";

// Agent-side spend queries. Mirrors `lib/merchant-queries.ts` but filters by
// `agent_id` (outgoing spends) instead of `counterparty` (incoming). Same
// composite-cursor pagination — `(created_at, id)` — so ties at a single
// microsecond can't drop rows.

/**
 * Opaque pagination cursor. Clients receive it as `nextCursor` and pass it
 * back as `cursor=...` on the subsequent request — encoded as base64url
 * JSON so the wire format is compact and self-describing.
 */
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

/**
 * Paginated feed of confirmed spends originated by this agent. Identical
 * predicate to the merchant feed but keyed on `agent_id` — so the same
 * `transactions` row shows up as outgoing here and incoming on the
 * merchant's dashboard.
 *
 * Uses a row-value tuple comparison `(created_at, id) < cursor` against the
 * `transactions_agent_id_created_at_idx` index. Ordering is
 * `(created_at DESC, id DESC)` so the tuple compare + limit produces a
 * deterministic page even under rapid inserts.
 */
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
