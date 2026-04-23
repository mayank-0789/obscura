import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, merchantApiKeys } from "@/lib/db";
import { apiError, apiOk } from "@/lib/api";
import { merchantAuthGuard } from "@/lib/merchant-auth";
import { checkLimit } from "@/lib/ratelimit";
import { generateMerchantApiKey } from "@/lib/merchant-keys";

// Create-key is a session-only operation — minting a new credential from an
// existing API key would allow a compromised key to self-perpetuate. We gate
// via authMode === 'session' so only browser-authed merchants can create keys.
const CreateKeyBody = z.object({
  label: z.string().trim().min(1).max(80).optional(),
});

// Ceiling on active keys per merchant. Bounded so a compromised session
// can't mint a long tail of credentials. 20 is generous (CI + multiple
// environments + bots) without enabling abuse.
const ACTIVE_KEY_LIMIT = 20;

// GET /api/merchants/me/keys — list non-revoked key metadata (no plaintext).
// Order by createdAt DESC — newest-first matches the credentials-list UX
// convention and the agents-list pattern (agents/route.ts:40).
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

// POST /api/merchants/me/keys — generate a new mk_... key for this merchant.
// Plaintext is returned exactly once; only the hash is stored. Gated to
// session-mode auth so an attacker with an mk_ key cannot mint more keys.
export async function POST(req: Request) {
  const ctx = await merchantAuthGuard(req);
  if (ctx instanceof Response) return ctx;

  if (ctx.authMode !== "session") {
    // A mk_-authed caller minting more mk_ keys = credential amplification.
    // The caller IS authenticated, they just lack privilege — 403 via the
    // `forbidden` code is the semantically correct surface.
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

  // Count active (non-revoked) keys. Revoked keys don't count toward the cap
  // so a merchant rotating credentials doesn't hit the ceiling.
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
      // Plaintext returned ONCE. Never stored, never retrievable again.
      plaintext: key.plaintext,
    },
    { status: 201 },
  );
}
