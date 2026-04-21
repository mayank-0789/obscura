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

// POST /api/onboarding/role — sets users.role and, if the chosen role requires
// a merchant record, provisions one. Idempotent: callable at any time.
//
// Rate-limited under the SAME key as POST /api/merchants so an attacker can't
// alternate between endpoints to mint multiple wallets. 1 create per 10s per
// user absorbs double-clicks; the unique index on merchants.owner_user_id is
// the true safety net for concurrent writes.
//
// Role-change rules:
//   - Downgrade to 'user' is REJECTED when a merchants row exists — would
//     orphan the row, leaving dashboard UI in an inconsistent state. A future
//     "deregister as merchant" flow must explicitly delete the merchant and
//     its downstream artifacts (keys, apis).
//   - Provisioning failures do NOT update users.role — better to let the
//     client retry from a clean state than to leave users claiming
//     'merchant' with no merchant row behind them.
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

  // Block role='user' when the user already has a merchant row. Demoting
  // without cleanup is the silent-orphan bug the audit caught.
  if (body.role === "user" && existingMerchant) {
    return apiError(
      "bad_request",
      "Cannot downgrade to 'user' role while a merchant account exists",
    );
  }

  const needsMerchant = body.role === "merchant" || body.role === "both";

  // Only rate-limit the provisioning path. A user flipping role values that
  // don't require merchant provisioning is a cheap UPDATE — no limiter needed.
  if (needsMerchant && !existingMerchant) {
    const allowed = await checkLimit("create-merchant", user.id, 1, "10 s");
    if (!allowed) return apiError("rate_limited");
  }

  let merchantRow = existingMerchant;
  let merchantCreated = false;
  if (needsMerchant) {
    try {
      const result = await provisionMerchant(user);
      merchantRow = result.merchant;
      merchantCreated = result.created;
    } catch (err) {
      if (err instanceof MerchantProvisionError) {
        console.error("[onboarding/role] provision failed:", err.code);
      } else {
        console.error("[onboarding/role] provision failed:", err);
      }
      return apiError("server_error");
    }
  }

  // For roles that don't need a merchant OR where provisionMerchant already
  // bumped the role via its batch, we still need to persist the explicit
  // choice (e.g. user picked 'merchant' but provisionMerchant bumped to 'both'
  // because it piggybacks on the existing 'user' role — this final update
  // sets the literal value the client asked for).
  const [updated] = await db
    .update(users)
    .set({ role: body.role, updatedAt: new Date() })
    .where(eq(users.id, user.id))
    .returning();

  if (!updated) return apiError("server_error");
  return apiOk(
    { user: updated, merchant: merchantRow, merchantCreated },
    { status: merchantCreated ? 201 : 200 },
  );
}
