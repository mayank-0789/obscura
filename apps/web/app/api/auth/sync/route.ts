import { db, users } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";

// Recovery for the Auth.js v5 token.sub random-UUID trap: upsert keyed by Google sub.
// Atomic INSERT...ON CONFLICT so concurrent rapid-remount syncs don't race on unique_violation.
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
