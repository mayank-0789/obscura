import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db, merchantApiKeys } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api";
import { merchantAuthGuard } from "@/lib/merchant-auth";

const IdSchema = z.string().uuid();

// DELETE /api/merchants/me/keys/[id] — soft-revoke by setting revoked_at.
// Session-only for the same reason as key creation: an mk_-authed caller
// should not be able to revoke OTHER keys belonging to the same merchant.
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await merchantAuthGuard(req);
  if (ctx instanceof Response) return ctx;

  if (ctx.authMode !== "session") {
    // mk_ API keys cannot revoke keys (including themselves). 403 because the
    // caller IS authenticated, just lacks privilege for this action.
    return apiError("forbidden");
  }

  const { id: rawId } = await params;
  const parsed = IdSchema.safeParse(rawId);
  if (!parsed.success) return apiError("bad_request");

  // Revoke only if this key belongs to this merchant AND isn't already
  // revoked (idempotent + prevents "un-revoking" a previously revoked row).
  const [row] = await db
    .update(merchantApiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(merchantApiKeys.id, parsed.data),
        eq(merchantApiKeys.merchantId, ctx.merchant.id),
        isNull(merchantApiKeys.revokedAt),
      ),
    )
    .returning({ id: merchantApiKeys.id });

  if (!row) return apiError("not_found");
  return apiOk({ id: row.id, revoked: true });
}
