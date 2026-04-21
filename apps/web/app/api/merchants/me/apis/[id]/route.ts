import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { db, merchantApis } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api";
import { merchantAuthGuard } from "@/lib/merchant-auth";
import {
  UpdateApiBodySchema,
  serializeMerchantApi,
  type UpdateApiBody,
} from "@/lib/merchant-apis";

const IdSchema = z.string().uuid();

// GET /api/merchants/me/apis/[id] — fetch a single entry. Merchant-scoped
// WHERE so other merchants' entries 404 rather than 403 (doesn't leak
// existence).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await merchantAuthGuard(req);
  if (ctx instanceof Response) return ctx;

  const { id: rawId } = await params;
  const parsed = IdSchema.safeParse(rawId);
  if (!parsed.success) return apiError("bad_request");

  const [row] = await db
    .select()
    .from(merchantApis)
    .where(
      and(
        eq(merchantApis.id, parsed.data),
        eq(merchantApis.merchantId, ctx.merchant.id),
      ),
    )
    .limit(1);

  if (!row) return apiError("not_found");
  return apiOk({ api: serializeMerchantApi(row) });
}

// PATCH /api/merchants/me/apis/[id] — partial update. At least one field in
// the body must be present. Endpoint changes re-check uniqueness.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await merchantAuthGuard(req);
  if (ctx instanceof Response) return ctx;

  const { id: rawId } = await params;
  const parsedId = IdSchema.safeParse(rawId);
  if (!parsedId.success) return apiError("bad_request");

  let body: UpdateApiBody;
  try {
    body = UpdateApiBodySchema.parse(await req.json());
  } catch {
    return apiError("bad_request");
  }

  // Reject empty-body PATCHes — a no-op update is a client bug, better to
  // surface it than silently bump updated_at.
  if (Object.keys(body).length === 0) {
    return apiError("bad_request", "At least one field required");
  }

  // If the caller is changing the endpoint, ensure no sibling entry already
  // claims the new value. `ne(id)` excludes the row being updated from the
  // uniqueness check — otherwise PATCHing the same endpoint back onto itself
  // would spuriously 409.
  if (body.endpoint) {
    const duplicate = await db
      .select({ id: merchantApis.id })
      .from(merchantApis)
      .where(
        and(
          eq(merchantApis.merchantId, ctx.merchant.id),
          eq(merchantApis.endpoint, body.endpoint),
          ne(merchantApis.id, parsedId.data),
        ),
      )
      .limit(1);
    if (duplicate.length > 0) {
      return apiError(
        "bad_request",
        "Another entry for this endpoint already exists",
      );
    }
  }

  const [updated] = await db
    .update(merchantApis)
    .set({ ...body, updatedAt: new Date() })
    .where(
      and(
        eq(merchantApis.id, parsedId.data),
        eq(merchantApis.merchantId, ctx.merchant.id),
      ),
    )
    .returning();

  if (!updated) return apiError("not_found");
  return apiOk({ api: serializeMerchantApi(updated) });
}

// DELETE /api/merchants/me/apis/[id] — hard delete. Safe because no downstream
// row has a NOT NULL FK to merchant_apis:
//   - `transactions.merchant_host` is plain text (not a FK)
//   - `x402_nonces.merchant_api_id` is a FK, but with `onDelete: "set null"`
//     so deleting an entry nulls the nonce's pointer without cascading.
// Catalog entries thus have no audit value post-removal; hard-delete keeps
// the table tight.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await merchantAuthGuard(req);
  if (ctx instanceof Response) return ctx;

  const { id: rawId } = await params;
  const parsed = IdSchema.safeParse(rawId);
  if (!parsed.success) return apiError("bad_request");

  const [row] = await db
    .delete(merchantApis)
    .where(
      and(
        eq(merchantApis.id, parsed.data),
        eq(merchantApis.merchantId, ctx.merchant.id),
      ),
    )
    .returning({ id: merchantApis.id });

  if (!row) return apiError("not_found");
  return apiOk({ id: row.id, deleted: true });
}
