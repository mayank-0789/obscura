import { authGuard } from "@/lib/auth";
import { apiOk } from "@/lib/api";

export async function GET(req: Request) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;
  return apiOk({ user });
}
