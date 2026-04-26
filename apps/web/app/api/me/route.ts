import { authGuard } from "@/lib/auth";
import { apiOk } from "@/lib/api";

// GET /api/me — returns the authenticated user row. The pre-pivot version
// also returned `solanaAddress` (the Privy embedded wallet); we no longer
// have a "user's personal Solana wallet" — only their agents do — so the
// field is dropped.
export async function GET(req: Request) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;
  return apiOk({ user });
}
