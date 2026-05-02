import { and, eq } from "drizzle-orm";
import { db, agents, budgets } from "@/lib/db";
import { authGuard } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";
import { serializeAgent } from "@/lib/agent-serialize";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;

  const { id } = await ctx.params;

  const [row] = await db
    .select({ agent: agents, budget: budgets })
    .from(agents)
    .leftJoin(budgets, eq(budgets.agentId, agents.id))
    .where(and(eq(agents.id, id), eq(agents.userId, user.id)))
    .limit(1);

  if (!row) return apiError("not_found");

  return apiOk({ agent: serializeAgent(row.agent, row.budget) });
}
