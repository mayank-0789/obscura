import type { User as PrivyUser } from "@privy-io/server-auth";
import { privy } from "@/lib/privy-server";
import { db, users } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";

// POST /api/auth/sync — upsert the current user row by privy_id. Idempotent,
// safe to call repeatedly (and raced by concurrent callers — the hook may
// fire more than once on rapid remounts or React strict-mode double-invokes).
//
// Implemented as a single atomic INSERT ... ON CONFLICT DO UPDATE so two
// concurrent syncs can't both insert and crash on the unique_violation.
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

    const [user] = await db
      .insert(users)
      .values({ privyId: privyUserId, email, phone })
      .onConflictDoUpdate({
        target: users.privyId,
        set: { email, phone, updatedAt: new Date() },
      })
      .returning();

    return apiOk({ user });
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
