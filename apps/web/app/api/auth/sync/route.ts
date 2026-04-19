import { eq } from "drizzle-orm";
import type { User as PrivyUser } from "@privy-io/server-auth";
import { privy } from "@/lib/privy-server";
import { db, users } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";

// POST /api/auth/sync — upsert user row by privy_id. Idempotent, safe to call repeatedly.
export async function POST(req: Request) {
  let privyUserId: string;
  try {
    privyUserId = await requireAuth(req);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.code);
    throw err;
  }

  try {
    const privyUser = await privy.getUserById(privyUserId);
    const email = extractEmail(privyUser);
    const phone = privyUser.phone?.number ?? null;

    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.privyId, privyUserId))
      .limit(1);

    if (!existing) {
      const [created] = await db
        .insert(users)
        .values({ privyId: privyUserId, email, phone })
        .returning();
      return apiOk({ user: created, isNew: true });
    }

    const [updated] = await db
      .update(users)
      .set({ email, phone, updatedAt: new Date() })
      .where(eq(users.privyId, privyUserId))
      .returning();

    return apiOk({ user: updated, isNew: false });
  } catch (err) {
    console.error("[auth/sync]", err);
    return apiError("server_error");
  }
}

// Privy stores the verified email in a different slot per login method.
function extractEmail(user: PrivyUser): string | null {
  return (
    user.email?.address ??
    user.google?.email ??
    user.apple?.email ??
    user.discord?.email ??
    null
  );
}
