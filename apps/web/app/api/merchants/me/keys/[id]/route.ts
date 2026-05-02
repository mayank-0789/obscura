import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db, merchantApiKeys } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api";
import { merchantAuthGuard } from "@/lib/merchant-auth";

const IdSchema = z.string().uuid();

// Soft-revoke via revoked_at — never hard DELETE. Session-only so an mk_-authed
// caller can't revoke sibling keys (or itself).
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await merchantAuthGuard(req);
  if (ctx instanceof Response) return ctx;

  if (ctx.authMode !== "session") {
    return apiError("forbidden");
  }

  const { id: rawId } = await params;
  const parsed = IdSchema.safeParse(rawId);
  if (!parsed.success) return apiError("bad_request");

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
