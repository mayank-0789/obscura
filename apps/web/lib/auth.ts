import "server-only";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth-config";
import { db, users, type User } from "@/lib/db";
import { apiError } from "@/lib/api";

export type AuthErrorCode =
  | "missing_token"
  | "invalid_token"
  | "user_not_synced";

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  missing_token: "No active session.",
  invalid_token: "Session is invalid or expired.",
  user_not_synced: "User row not found for the authenticated session.",
};

export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode) {
    super(AUTH_ERROR_MESSAGES[code]);
    this.name = "AuthError";
  }
}

/** Verifies the active NextAuth session. Session-only — distinct from `requireAgentApiKey` (mk_/pk_ Bearer tokens) in the dual-auth model. */
export async function requireAuth(_req?: Request): Promise<{ sub: string; email: string }> {
  void _req;
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    throw new AuthError("missing_token");
  }
  return { sub: session.user.id, email: session.user.email };
}

/** Resolves a verified Google sub to our DB row. Split from `requireUser` so dual-auth callers can reuse it. */
export async function loadUserByAuthId(authId: string): Promise<User> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.authId, authId))
    .limit(1);
  if (!user) throw new AuthError("user_not_synced");
  return user;
}

/** Verifies session AND resolves the DB user row. Throws AuthError('user_not_synced') if the row is missing — client recovers via /api/auth/sync. */
export async function requireUser(req?: Request): Promise<User> {
  const { sub } = await requireAuth(req);
  return loadUserByAuthId(sub);
}

/** Wraps `requireUser`, returning either the user or an error Response for direct return from a route. */
export async function authGuard(req?: Request): Promise<User | Response> {
  try {
    return await requireUser(req);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.code);
    throw err;
  }
}
