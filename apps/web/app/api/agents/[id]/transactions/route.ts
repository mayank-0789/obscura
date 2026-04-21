import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, agents } from "@/lib/db";
import { authGuard } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";
import {
  decodeAgentTxCursor,
  getAgentTransactions,
} from "@/lib/agent-queries";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  cursor: z.string().min(1).optional(),
});

// GET /api/agents/[id]/transactions?limit=50&cursor=<opaque>
//
// Returns confirmed spend rows originated by this agent. Scoped to the
// current user via the same 404-covers-both-cases pattern as GET
// /api/agents/[id] — we don't leak "exists but not yours."
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;

  const { id } = await ctx.params;

  // Verify the agent exists + belongs to the caller before reading the
  // transactions table. Returning 404 without this join would let someone
  // enumerate agent ids (the tx query filters by agent_id but wouldn't
  // 404 for an agent belonging to another user).
  const [agent] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, user.id)))
    .limit(1);
  if (!agent) return apiError("not_found");

  const url = new URL(req.url);
  const parsed = QuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
  });
  if (!parsed.success) return apiError("bad_request");

  let cursor;
  if (parsed.data.cursor) {
    const decoded = decodeAgentTxCursor(parsed.data.cursor);
    if (!decoded) return apiError("bad_request");
    cursor = decoded;
  }

  const { rows, nextCursor } = await getAgentTransactions({
    agentId: agent.id,
    limit: parsed.data.limit,
    cursor,
  });

  return apiOk({
    transactions: rows.map((r) => ({
      id: r.id,
      agentId: r.agentId,
      amountUsdg: r.amountUsdg.toString(),
      counterparty: r.counterparty,
      merchantHost: r.merchantHost,
      solanaSig: r.solanaSig,
      createdAt: r.createdAt,
      confirmedAt: r.confirmedAt,
    })),
    nextCursor,
  });
}
