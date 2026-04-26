import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  merchants,
  merchantApiKeys,
  type Merchant,
  type User,
} from "@/lib/db";
import { auth } from "@/lib/auth-config";
import { apiError } from "@/lib/api";
import { AuthError, loadUserByAuthId } from "@/lib/auth";
import {
  hashMerchantApiKey,
  MERCHANT_KEY_PREFIX,
} from "@/lib/merchant-keys";

export type MerchantAuthErrorCode =
  | "missing_token"
  | "invalid_token"
  | "user_not_synced"
  | "not_found";

export class MerchantAuthError extends Error {
  constructor(public readonly code: MerchantAuthErrorCode) {
    super(code);
    this.name = "MerchantAuthError";
  }
}

/**
 * Context produced by `requireMerchant` / `merchantAuthGuard`.
 *
 * `user` is only present when the caller authenticated via session cookie
 * (i.e. a logged-in browser). mk_ Bearer callers have no associated session,
 * so `user` is null — if a downstream handler needs the owning user it can
 * query by `merchant.ownerUserId`.
 */
export type MerchantContext = {
  merchant: Merchant;
  user: User | null;
  authMode: "session" | "api_key";
};

/**
 * Dual-mode auth for merchant-scoped endpoints. Accepts either:
 *   - `Authorization: Bearer mk_...`  → look up merchant_api_keys
 *   - NextAuth session cookie          → resolve user, load merchant by ownerUserId
 *
 * Routing: if a Bearer header is present we take that path; otherwise we
 * fall back to NextAuth's `auth()` which reads the session cookie.
 */
export async function requireMerchant(req: Request): Promise<MerchantContext> {
  const token = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (token && token.startsWith(MERCHANT_KEY_PREFIX)) {
    return resolveByApiKey(token);
  }
  return resolveBySession();
}

async function resolveByApiKey(token: string): Promise<MerchantContext> {
  const keyHash = hashMerchantApiKey(token);
  const rows = await db
    .select({
      merchant: merchants,
      keyId: merchantApiKeys.id,
    })
    .from(merchantApiKeys)
    .innerJoin(merchants, eq(merchants.id, merchantApiKeys.merchantId))
    .where(
      and(
        eq(merchantApiKeys.keyHash, keyHash),
        isNull(merchantApiKeys.revokedAt),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) throw new MerchantAuthError("invalid_token");

  // Best-effort lastUsedAt bump. Fired and forgotten — we don't block the
  // request on a metadata update, and we swallow failures (the request is
  // already authorized; a metadata miss is cosmetic for the UI).
  void db
    .update(merchantApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(merchantApiKeys.id, row.keyId))
    .catch((err) => {
      console.error("[merchant-auth] lastUsedAt bump failed:", err);
    });

  return { merchant: row.merchant, user: null, authMode: "api_key" };
}

async function resolveBySession(): Promise<MerchantContext> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new MerchantAuthError("missing_token");
  }

  // Delegated to lib/auth so merchant-auth inherits any future checks
  // (banned-user, soft-delete) added to the shared user resolver.
  let user: User;
  try {
    user = await loadUserByAuthId(session.user.id);
  } catch (err) {
    if (err instanceof AuthError && err.code === "user_not_synced") {
      throw new MerchantAuthError("user_not_synced");
    }
    throw err;
  }

  const [merchant] = await db
    .select()
    .from(merchants)
    .where(eq(merchants.ownerUserId, user.id))
    .limit(1);
  if (!merchant) throw new MerchantAuthError("not_found");

  return { merchant, user, authMode: "session" };
}

/**
 * Route-ergonomics wrapper matching `authGuard` / `agentAuthGuard`:
 *   const ctx = await merchantAuthGuard(req);
 *   if (ctx instanceof Response) return ctx;
 */
export async function merchantAuthGuard(
  req: Request,
): Promise<MerchantContext | Response> {
  try {
    return await requireMerchant(req);
  } catch (err) {
    if (err instanceof MerchantAuthError) {
      return apiError(err.code);
    }
    throw err;
  }
}
