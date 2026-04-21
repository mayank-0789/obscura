import { and, desc, eq, sql } from "drizzle-orm";
import { db, merchantApis } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api";
import { merchantAuthGuard } from "@/lib/merchant-auth";
import {
  CreateApiBodySchema,
  serializeMerchantApi,
  type CreateApiBody,
} from "@/lib/merchant-apis";

// Ceiling on API catalog entries per merchant. High enough to cover any
// realistic merchant taxonomy; low enough that one merchant can't flood the
// table. Revise if merchants with extensive routes show up.
const APIS_PER_MERCHANT_LIMIT = 200;

// GET /api/merchants/me/apis — list the merchant's registered catalog.
// Ordered newest-first (matches the keys + agents list convention).
export async function GET(req: Request) {
  const ctx = await merchantAuthGuard(req);
  if (ctx instanceof Response) return ctx;

  const rows = await db
    .select()
    .from(merchantApis)
    .where(eq(merchantApis.merchantId, ctx.merchant.id))
    .orderBy(desc(merchantApis.createdAt));

  return apiOk({ apis: rows.map(serializeMerchantApi) });
}

// POST /api/merchants/me/apis — register a new API entry. Passive catalog
// only: this row does NOT affect SDK pricing or runtime behaviour. It powers
// friendly-name lookups + per-API analytics on the merchant dashboard.
//
// Dual-auth (session OR mk_): either path may create entries. An mk_ caller
// minting their own catalog entries is fine — they can't escalate, and
// programmatic registration is a legitimate workflow.
export async function POST(req: Request) {
  const ctx = await merchantAuthGuard(req);
  if (ctx instanceof Response) return ctx;

  let body: CreateApiBody;
  try {
    body = CreateApiBodySchema.parse(await req.json());
  } catch {
    return apiError("bad_request");
  }

  // Uniqueness within a merchant's catalog: (merchant_id, endpoint) is the
  // sensible key — two entries with the same endpoint would be ambiguous for
  // the dashboard's friendly-name lookup. Enforced in application code since
  // the schema doesn't have the composite unique index (would require a
  // schema change; acceptable for v1 given the low create rate).
  const duplicate = await db
    .select({ id: merchantApis.id })
    .from(merchantApis)
    .where(
      and(
        eq(merchantApis.merchantId, ctx.merchant.id),
        eq(merchantApis.endpoint, body.endpoint),
      ),
    )
    .limit(1);
  if (duplicate.length > 0) {
    return apiError("bad_request", "An entry for this endpoint already exists");
  }

  // Ceiling check via SQL count — avoids pulling every row into JS just to
  // check length. Still racy (read-then-insert) but bounded by the soft cap.
  const [countRow] = await db
    .select({ n: sql<number>`cast(count(*) as integer)` })
    .from(merchantApis)
    .where(eq(merchantApis.merchantId, ctx.merchant.id));
  if ((countRow?.n ?? 0) >= APIS_PER_MERCHANT_LIMIT) {
    return apiError("bad_request", "API catalog entry limit reached");
  }

  const [inserted] = await db
    .insert(merchantApis)
    .values({
      merchantId: ctx.merchant.id,
      name: body.name,
      endpoint: body.endpoint,
      defaultPriceUsdg: body.defaultPriceUsdg,
      status: body.status,
    })
    .returning();

  if (!inserted) return apiError("server_error");
  return apiOk({ api: serializeMerchantApi(inserted) }, { status: 201 });
}
