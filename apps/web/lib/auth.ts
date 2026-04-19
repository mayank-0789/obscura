import "server-only";
import { privy } from "@/lib/privy-server";

export class AuthError extends Error {
  constructor(public readonly code: "missing_token" | "invalid_token") {
    super(code);
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
