import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { requireAuth, AuthError } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";

// POST /api/auth/signout — server-side acknowledgement of sign-out.
// Privy JWTs are stateless; cookie clearing happens in the client via privy.logout().
// This endpoint bumps users.updated_at as a last-seen signal and gives us a hook for
// future audit/cleanup without forcing a client-only logout contract.
export async function POST(req: Request) {
  let privyUserId: string;
  try {
    privyUserId = await requireAuth(req);
  } catch (err) {
    if (err instanceof AuthError) return apiError(err.code);
    throw err;
  }

  await db
    .update(users)
    .set({ updatedAt: new Date() })
    .where(eq(users.privyId, privyUserId));

  return apiOk({ ok: true });
}
