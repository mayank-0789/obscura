import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, merchantApiKeys } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api";
import { merchantAuthGuard } from "@/lib/merchant-auth";
import { checkLimit } from "@/lib/ratelimit";
import { generateMerchantApiKey } from "@/lib/merchant-keys";

const CreateKeyBody = z.object({
  label: z.string().trim().min(1).max(80).optional(),
});

const ACTIVE_KEY_LIMIT = 20;

export async function GET(req: Request) {
  const ctx = await merchantAuthGuard(req);
  if (ctx instanceof Response) return ctx;

  const rows = await db
    .select({
      id: merchantApiKeys.id,
      label: merchantApiKeys.label,
      lastUsedAt: merchantApiKeys.lastUsedAt,
      createdAt: merchantApiKeys.createdAt,
    })
    .from(merchantApiKeys)
    .where(
      and(
        eq(merchantApiKeys.merchantId, ctx.merchant.id),
        isNull(merchantApiKeys.revokedAt),
      ),
    )
    .orderBy(desc(merchantApiKeys.createdAt));

  return apiOk({ keys: rows });
}

export async function POST(req: Request) {
  const ctx = await merchantAuthGuard(req);
  if (ctx instanceof Response) return ctx;

  // Gate to session-mode auth so an mk_-authed caller can't mint more mk_ keys (credential amplification).
  if (ctx.authMode !== "session") {
    return apiError("forbidden");
  }

  let body: z.infer<typeof CreateKeyBody>;
  try {
    body = CreateKeyBody.parse(await req.json());
  } catch {
    return apiError("bad_request");
  }

  const allowed = await checkLimit(
    "create-merchant-key",
    ctx.merchant.id,
    10,
    "1 h",
  );
  if (!allowed) return apiError("rate_limited");

  const activeKeys = await db
    .select({ id: merchantApiKeys.id })
    .from(merchantApiKeys)
    .where(
      and(
        eq(merchantApiKeys.merchantId, ctx.merchant.id),
        isNull(merchantApiKeys.revokedAt),
      ),
    );
  if (activeKeys.length >= ACTIVE_KEY_LIMIT) {
    return apiError("bad_request", "Active key limit reached");
  }

  const key = generateMerchantApiKey();
  const [inserted] = await db
    .insert(merchantApiKeys)
    .values({
      merchantId: ctx.merchant.id,
      keyHash: key.hash,
      label: body.label ?? null,
    })
    .returning({
      id: merchantApiKeys.id,
      label: merchantApiKeys.label,
      createdAt: merchantApiKeys.createdAt,
    });

  if (!inserted) return apiError("server_error");

  return apiOk(
    {
      key: {
        id: inserted.id,
        label: inserted.label,
        createdAt: inserted.createdAt,
      },
      plaintext: key.plaintext,
    },
    { status: 201 },
  );
}
