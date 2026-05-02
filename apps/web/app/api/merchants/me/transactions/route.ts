import { z } from "zod";
import { apiError, apiOk } from "@/lib/api";
import { merchantAuthGuard } from "@/lib/merchant-auth";
import {
  decodeMerchantTxCursor,
  getMerchantTransactions,
} from "@/lib/merchant-queries";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().min(1).optional(),
});

// Reads must hit the partial index on (counterparty, status, kind='spend');
// keep the underlying query aligned with that predicate.
export async function GET(req: Request) {
  const ctx = await merchantAuthGuard(req);
  if (ctx instanceof Response) return ctx;

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) return apiError("bad_request");

  // Malformed cursor → 400 instead of silently restarting at page 1.
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
