import { db, users } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";

// POST /api/auth/sync — upsert the current user row keyed by Google sub.
// Idempotent, safe to call repeatedly (and raced by concurrent callers — the
// hook may fire more than once on rapid remounts).
//
// Implemented as a single atomic INSERT ... ON CONFLICT DO UPDATE so two
// concurrent syncs can't both insert and crash on unique_violation.
export async function POST(req: Request) {
  let sub: string;
  let email: string;
  try {
    ({ sub, email } = await requireAuth(req));
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.code);
    throw err;
  }

  try {
    const [user] = await db
      .insert(users)
      .values({ authId: sub, email, phone: null })
      .onConflictDoUpdate({
        target: users.authId,
        set: { email, updatedAt: new Date() },
      })
      .returning();

    return apiOk({ user });
  } catch (err) {
    console.error("[auth/sync]", err);
    return apiError("server_error");
  }
}
