import { authGuard } from "@/lib/auth";
import { apiOk } from "@/lib/api";

// GET /api/me — returns the authenticated user row. Users don't hold a
// personal Solana wallet — only their agents do.
export async function GET(req: Request) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;
  return apiOk({ user });
}
