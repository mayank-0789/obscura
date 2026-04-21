import "server-only";
import { and, countDistinct, desc, eq, sql } from "drizzle-orm";
import { db, transactions, type Transaction } from "@/lib/db";

/**
 * Aggregate stats for the merchant dashboard. Single scan over transactions
 * using the partial index (counterparty, status, created_at DESC) WHERE
 * kind = 'spend'.
 *
 * All sums are returned as strings (from bigint) because JS `number` can't
 * safely hold values beyond 2^53 — USDG atomic units are 6 decimals so we'd
 * overflow at ~$9B earned, unlikely but better to be bigint-honest from day 1.
 */
export type MerchantStats = {
  callsCount: number;
  uniquePayersCount: number;
  totalEarnedUsdg: string;
  thisMonthEarnedUsdg: string;
};

export async function getMerchantStats(
  payoutWallet: string,
): Promise<MerchantStats> {
  // Single aggregate query. Using raw SQL for the conditional SUM because
  // drizzle's CASE WHEN ergonomics around bigints are clunkier than a literal
  // SQL expression.
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
        eq(transactions.counterparty, payoutWallet),
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
 * Opaque pagination cursor encoding the last-seen row's `(created_at, id)`.
 * Composite ordering ensures rows with identical `created_at` microseconds
 * (possible under batch inserts) never drop from the feed — the id tiebreaker
 * picks a deterministic winner.
 *
 * Clients treat the returned `nextCursor` string as opaque.
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
 * Paginated feed of confirmed spends paid to this merchant. Cursor-based
 * pagination on `(created_at DESC, id DESC)`: row-value tuple comparison
 * prevents the microsecond-tie data-loss edge case (two rows sharing the
 * same created_at would both be skipped with a pure `created_at < cursor`
 * predicate).
 */
export async function getMerchantTransactions(input: {
  payoutWallet: string;
  limit: number;
  cursor?: MerchantTxCursor;
}): Promise<{ rows: Transaction[]; nextCursor: string | null }> {
  const limit = Math.min(Math.max(input.limit, 1), 100);
  const whereClauses = [
    eq(transactions.counterparty, input.payoutWallet),
    eq(transactions.kind, "spend"),
    eq(transactions.status, "confirmed"),
  ];
  if (input.cursor) {
    // Row-value tuple comparison: (created_at, id) < (cursor_ts, cursor_id)
    // evaluates lexicographically. Postgres supports this directly and it
    // matches the (created_at DESC, id DESC) ORDER BY — so the last row of
    // page N is the strict upper bound for page N+1.
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
