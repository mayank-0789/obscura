import { desc, eq, sql } from "drizzle-orm";
import { db, merchantApis } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api";
import { merchantAuthGuard } from "@/lib/merchant-auth";
import {
  CreateApiBodySchema,
  serializeMerchantApi,
  type CreateApiBody,
} from "@/lib/merchant-apis";

const APIS_PER_MERCHANT_LIMIT = 200;

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

export async function POST(req: Request) {
  const ctx = await merchantAuthGuard(req);
  if (ctx instanceof Response) return ctx;

  let body: CreateApiBody;
  try {
    body = CreateApiBodySchema.parse(await req.json());
  } catch {
    return apiError("bad_request");
  }

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
    .onConflictDoNothing({
      target: [merchantApis.merchantId, merchantApis.endpoint],
    })
    .returning();

  if (!inserted) {
    return apiError("bad_request", "An entry for this endpoint already exists");
  }
  return apiOk({ api: serializeMerchantApi(inserted) }, { status: 201 });
}
