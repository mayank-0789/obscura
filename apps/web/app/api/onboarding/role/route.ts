import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { authGuard } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";
import { checkLimit } from "@/lib/ratelimit";
import {
  provisionMerchant,
  getMerchantByOwner,
  MerchantProvisionError,
} from "@/lib/merchants";

const RoleBody = z.object({
  role: z.enum(["user", "merchant", "both"]),
});

export async function POST(req: Request) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;

  let body: z.infer<typeof RoleBody>;
  try {
    body = RoleBody.parse(await req.json());
  } catch {
    return apiError("bad_request");
  }

  const existingMerchant = await getMerchantByOwner(user.id);

  // Block downgrade to 'user' when a merchant row exists — orphan defense.
  if (body.role === "user" && existingMerchant) {
    return apiError(
      "bad_request",
      "Cannot downgrade to 'user' role while a merchant account exists",
    );
  }

  const needsMerchant = body.role === "merchant" || body.role === "both";

  if (needsMerchant && !existingMerchant) {
    // Shared rate-limit key with /api/merchants — alternation defense.
    const allowed = await checkLimit("create-merchant", user.id, 1, "10 s");
    if (!allowed) return apiError("rate_limited");
  }

  let merchantRow = existingMerchant;
  let merchantCreated = false;
  let merchantApiKey: string | null = null;
  if (needsMerchant) {
    try {
      const result = await provisionMerchant(user);
      merchantRow = result.merchant;
      merchantCreated = result.created;
      merchantApiKey = result.apiKey?.plaintext ?? null;
    } catch (err) {
      if (err instanceof MerchantProvisionError) {
        console.error("[onboarding/role] provision failed:", err.code);
      } else {
        console.error("[onboarding/role] provision failed:", err);
      }
      return apiError("server_error");
    }
  }

  const [updated] = await db
    .update(users)
    .set({ role: body.role, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();

  if (!updated) return apiError("server_error");
  return apiOk(
    {
      user: updated,
      merchant: merchantRow,
      merchantCreated,
      apiKey: merchantApiKey,
    },
    { status: merchantCreated ? 201 : 200 },
  );
}
