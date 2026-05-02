import "server-only";
import { and, countDistinct, desc, eq, sql } from "drizzle-orm";
import { db, transactions, type Transaction } from "@/lib/db";

/**
 * Aggregate stats for the merchant dashboard. Sums returned as bigint-safe
 * strings — JS `number` overflows beyond ~$9B earned.
 */
export type MerchantStats = {
  callsCount: number;
  uniquePayersCount: number;
  totalEarnedUsdg: string;
  thisMonthEarnedUsdg: string;
};

export async function getMerchantStats(
  etaAddress: string,
): Promise<MerchantStats> {
  const [row] = await db
    .select({
      callsCount: sql<number>`cast(count(*) as integer)`,
      uniquePayers: countDistinct(transactions.agentId),
      totalEarned: sql<string>`coalesce(sum(${transactions.amountUsdg}), 0)::text`,
      thisMonthEarned: sql<string>`coalesce(sum(case when ${transactions.createdAt} >= date_trunc('month', now()) then ${transactions.amountUsdg} else 0 end), 0)::text`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.counterparty, etaAddress),
        eq(transactions.kind, "spend"),
        eq(transactions.status, "confirmed"),
      ),
    );

  return {
    callsCount: row?.callsCount ?? 0,
    uniquePayersCount: row?.uniquePayers ?? 0,
    totalEarnedUsdg: row?.totalEarned ?? "0",
    thisMonthEarnedUsdg: row?.thisMonthEarned ?? "0",
  };
}

/**
 * Opaque cursor encoding `(created_at, id)`. The id tiebreaker prevents
 * dropped rows when multiple share the same microsecond timestamp.
 */
export type MerchantTxCursor = { createdAt: string; id: string };

export function encodeMerchantTxCursor(c: MerchantTxCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

export function decodeMerchantTxCursor(
  s: string,
): MerchantTxCursor | null {
  try {
    const raw = Buffer.from(s, "base64url").toString("utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "createdAt" in parsed &&
      "id" in parsed &&
      typeof (parsed as MerchantTxCursor).createdAt === "string" &&
      typeof (parsed as MerchantTxCursor).id === "string"
    ) {
      return parsed as MerchantTxCursor;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Paginated feed of confirmed spends paid to this merchant. Row-value tuple
 * comparison `(created_at, id) < (cursor_ts, cursor_id)` matches ORDER BY
 * `(created_at DESC, id DESC)` and avoids the microsecond-tie data-loss edge.
 */
export async function getMerchantTransactions(input: {
  etaAddress: string;
  limit: number;
  cursor?: MerchantTxCursor;
}): Promise<{ rows: Transaction[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(input.limit, 1), 100);
  const whereClauses = [
    eq(transactions.counterparty, input.etaAddress),
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
      ? encodeMerchantTxCursor({
          createdAt: lastRow.createdAt.toISOString(),
          id: lastRow.id,
        })
      : null;
  return { rows: trimmed, nextCursor };
}
