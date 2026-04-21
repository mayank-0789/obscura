import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  merchants,
  merchantApiKeys,
  type Merchant,
  type User,
} from "@/lib/db";
import { privy } from "@/lib/privy-server";
import { apiError } from "@/lib/api";
import { AuthError, loadUserByPrivyId } from "@/lib/auth";
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
 * `user` is only present when the caller authenticated via Privy session JWT
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
 *   - `Authorization: Bearer <JWT>`    → verify Privy token, load user, load
 *                                        merchant by ownerUserId
 *
 * We route by token prefix (mk_ vs. anything else) — zero-cost diagnostic,
 * no ambiguity, no speculative Privy verify on a clearly-mk_ token.
 */
export async function requireMerchant(req: Request): Promise<MerchantContext> {
  const token = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) throw new MerchantAuthError("missing_token");

  if (token.startsWith(MERCHANT_KEY_PREFIX)) {
    return resolveByApiKey(token);
  }
  return resolveBySessionJwt(token);
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

async function resolveBySessionJwt(token: string): Promise<MerchantContext> {
  let privyUserId: string;
  try {
    const result = await privy.verifyAuthToken(token);
    privyUserId = result.userId;
  } catch {
    throw new MerchantAuthError("invalid_token");
  }

  // Delegated to lib/auth so merchant-auth inherits any future checks
  // (banned-user, soft-delete) added to the shared user resolver.
  let user: User;
  try {
    user = await loadUserByPrivyId(privyUserId);
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
