import "server-only";
import { eq } from "drizzle-orm";
import { privy } from "@/lib/privy-server";
import { db, users, type User } from "@/lib/db";
import { apiError } from "@/lib/api";

export type AuthErrorCode =
  | "missing_token"
  | "invalid_token"
  | "user_not_synced";

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  missing_token: "Authorization header is missing or empty.",
  invalid_token: "Auth token failed verification.",
  user_not_synced: "User row not found for the authenticated Privy id.",
};

export class AuthError extends Error {
  constructor(public readonly code: AuthErrorCode) {
    super(AUTH_ERROR_MESSAGES[code]);
    this.name = "AuthError";
  }
}

// Verifies the Bearer JWT from the request. Returns the Privy user id or throws AuthError.
export async function requireAuth(req: Request): Promise<string> {
  const token = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();

  if (!token) throw new AuthError("missing_token");

  try {
    const { userId } = await privy.verifyAuthToken(token);
    return userId;
  } catch {
    throw new AuthError("invalid_token");
  }
}

// Verifies the JWT AND resolves the Privy user to our DB row. Use in routes
// that operate on user-scoped resources (agents, merchants, top-ups). Throws
// AuthError('user_not_synced') if the JWT is valid but the DB row is missing
// — client should recover by posting /api/auth/sync.
export async function requireUser(req: Request): Promise<User> {
  const privyUserId = await requireAuth(req);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.privyId, privyUserId))
    .limit(1);
  if (!user) throw new AuthError("user_not_synced");
  return user;
}

// Thin wrapper around requireUser that returns the user OR an error response.
// Routes do:  `const u = await authGuard(req); if (u instanceof Response) return u;`
// Keeps every route's first three lines a single line.
export async function authGuard(req: Request): Promise<User | Response> {
  try {
    return await requireUser(req);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.code);
    throw err;
  }
}
