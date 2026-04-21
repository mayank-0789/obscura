import { authGuard } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";
import { checkLimit } from "@/lib/ratelimit";
import {
  provisionMerchant,
  getMerchantByOwner,
  MerchantProvisionError,
} from "@/lib/merchants";

// POST /api/merchants — idempotent merchant provisioning for the current user.
//
// Usage paths:
// - New signup picked "Merchant" in /onboarding → /api/onboarding/role is the
//   canonical path and handles merchant + role atomically.
// - Existing agent-dev (role='user') clicks "Register as merchant" from
//   settings → this endpoint bumps their role to 'both' via provisionMerchant's
//   batched insert + role-update.
//
// Race safety: double-POST from same user is handled by (a) a 1-per-10s rate
// limit shared with /api/onboarding/role via the "create-merchant" key, and
// (b) a DB unique index on merchants.owner_user_id that serializes concurrent
// INSERTs. The losing caller re-reads the winner's row and orphans its own
// freshly minted Privy wallet.
export async function POST(req: Request) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;

  const existing = await getMerchantByOwner(user.id);
  if (existing) return apiOk({ merchant: existing, created: false });

  const allowed = await checkLimit("create-merchant", user.id, 1, "10 s");
  if (!allowed) return apiError("rate_limited");

  try {
    const result = await provisionMerchant(user);
    return apiOk(result, { status: result.created ? 201 : 200 });
  } catch (err) {
    if (err instanceof MerchantProvisionError) {
      console.error("[merchants/create] provision failed:", err.code);
    } else {
      console.error("[merchants/create] provision failed:", err);
    }
    return apiError("server_error");
  }
}
