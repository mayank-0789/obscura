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

// Verifies the active NextAuth session. Returns the Google sub + email or
// throws AuthError. The session is read from cookies via Auth.js — no Bearer
// token to extract.
//
// `_req` accepted but unused, so existing callers that pass `req` (legacy
// from the Privy Bearer-token era) continue to compile during the migration.
// Drop the param across the codebase in a later cleanup pass.
export async function requireAuth(_req?: Request): Promise<{ sub: string; email: string }> {
  void _req;
  const session = await auth();
  if (!session?.user?.id || !session.user.email) {
    throw new AuthError("missing_token");
  }
  return { sub: session.user.id, email: session.user.email };
}

// Resolves a verified Google sub to our DB row. Separated from `requireUser`
// so callers that verify the session themselves (e.g. the merchant dual-auth
// guard, which also accepts mk_ Bearer keys) can reuse the row lookup.
export async function loadUserByAuthId(authId: string): Promise<User> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.authId, authId))
    .limit(1);
  if (!user) throw new AuthError("user_not_synced");
  return user;
}

// Verifies the session AND resolves the user to our DB row. Use in routes
// that operate on user-scoped resources. Throws AuthError('user_not_synced')
// if the session is valid but the DB row is missing — the client recovers by
// posting /api/auth/sync.
export async function requireUser(req?: Request): Promise<User> {
  const { sub } = await requireAuth(req);
  return loadUserByAuthId(sub);
}

// Thin wrapper around requireUser that returns the user OR an error response.
// Routes do:  `const u = await authGuard(req); if (u instanceof Response) return u;`
// (req is unused under NextAuth — kept for migration ergonomics.)
export async function authGuard(req?: Request): Promise<User | Response> {
  try {
    return await requireUser(req);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.code);
    throw err;
  }
}
