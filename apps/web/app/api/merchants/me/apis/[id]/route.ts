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

  if (Object.keys(body).length === 0) {
    return apiError("bad_request", "At least one field required");
  }

  // ne(id) excludes self so PATCHing the same endpoint back doesn't false-409.
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

// Hard delete is safe: x402_nonces FK is ON DELETE SET NULL, transactions.merchant_host isn't a FK.
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
