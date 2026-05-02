import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { authGuard } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";

export async function POST(req: Request) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;

  try {
    await db
      .update(users)
      .set({ updatedAt: new Date() })
      .where(eq(users.id, user.id));
    return apiOk({ ok: true });
  } catch (err) {
    console.error("[auth/signout] db update failed", err);
    return apiError("server_error");
  }
}
