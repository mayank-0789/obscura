import { authGuard } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";
import { checkLimit } from "@/lib/ratelimit";
import {
  provisionMerchant,
  getMerchantByOwner,
  MerchantProvisionError,
} from "@/lib/merchants";

export async function POST(req: Request) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;

  const existing = await getMerchantByOwner(user.id);
  if (existing) {
    return apiOk({ merchant: existing, created: false, apiKey: null });
  }

  // Shared rate-limit key with /api/onboarding/role — alternation defense.
  const allowed = await checkLimit("create-merchant", user.id, 1, "10 s");
  if (!allowed) return apiError("rate_limited");

  try {
    const result = await provisionMerchant(user);
    return apiOk(
      {
        merchant: result.merchant,
        created: result.created,
        apiKey: result.apiKey?.plaintext ?? null,
      },
      { status: result.created ? 201 : 200 },
    );
  } catch (err) {
    if (err instanceof MerchantProvisionError) {
      console.error("[merchants/create] provision failed:", err.code);
    } else {
      console.error("[merchants/create] provision failed:", err);
    }
    return apiError("server_error");
  }
}
