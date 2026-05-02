import { and, eq } from "drizzle-orm";
import { db, agents } from "@/lib/db";
import { authGuard } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";
import { env } from "@/lib/env";
import { getEncryptedBalance } from "@/lib/umbra";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;

  const { id } = await ctx.params;

  const [agent] = await db
    .select({ id: agents.id, umbraStatus: agents.umbraStatus })
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, user.id)))
    .limit(1);
  if (!agent) return apiError("not_found");

  if (agent.umbraStatus !== "active") {
    return apiOk({ amount: "0", decimals: env.STABLECOIN_DECIMALS });
  }

  try {
    const balance = await getEncryptedBalance("agent", agent.id);
    return apiOk({
      amount: (balance ?? 0n).toString(),
      decimals: env.STABLECOIN_DECIMALS,
    });
  } catch (err) {
    console.error(`[agents/balance] umbra read failed for agent=${agent.id}:`, err);
    return apiError("server_error");
  }
}
