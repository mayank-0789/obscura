import { z } from "zod";
import { apiError, apiOk } from "@/lib/api";
import { merchantAuthGuard } from "@/lib/merchant-auth";
import {
  decodeMerchantTxCursor,
  getMerchantTransactions,
} from "@/lib/merchant-queries";

const QuerySchema = z.object({
  // Page size. Clamped server-side to [1, 100].
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  // Opaque cursor returned by the previous page's `nextCursor`. Encodes
  // (created_at, id) so ties at the same microsecond can't drop rows.
  cursor: z.string().min(1).optional(),
});

// GET /api/merchants/me/transactions?limit=50&cursor=<opaque>
//
// Returns confirmed x402 spend rows where counterparty matches the
// authenticated merchant's etaAddress. Cursor-based pagination on
// (created_at DESC, id DESC).
export async function GET(req: Request) {
  const ctx = await merchantAuthGuard(req);
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) return apiError("bad_request");

  // Malformed cursor → 400. Better than silently treating it as no cursor,
  // which would dump page 1 when the client expected page N.
  let cursor;
  if (parsed.data.cursor) {
    const decoded = decodeMerchantTxCursor(parsed.data.cursor);
    if (!decoded) return apiError("bad_request");
    cursor = decoded;
  }

  const { rows, nextCursor } = await getMerchantTransactions({
    etaAddress: ctx.merchant.etaAddress,
    limit: parsed.data.limit,
    cursor,
  });

  return apiOk({
    transactions: rows.map((r) => ({
      id: r.id,
      agentId: r.agentId,
      amountUsdg: r.amountUsdg.toString(),
      counterparty: r.counterparty,
      merchantHost: r.merchantHost,
      solanaSig: r.solanaSig,
      createdAt: r.createdAt,
      confirmedAt: r.confirmedAt,
    })),
    nextCursor,
  });
}
