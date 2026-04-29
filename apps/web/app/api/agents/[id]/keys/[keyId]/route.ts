import { z } from "zod";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, agents, agentApiKeys } from "@/lib/db";
import { authGuard } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";

const IdSchema = z.string().uuid();

// DELETE /api/agents/[id]/keys/[keyId] — soft-revoke an agent API key.
//
// Three-layer ownership: the session user owns the agent, and the key
// belongs to that agent. All three checks live in the WHERE clause so a
// malicious actor can't probe key existence by IDs they don't own — every
// failure shape is the same 404.
//
// Last-key guard: revoking the FINAL active key would leave the agent
// un-authable silently (every subsequent /api/x402/sign would return
// invalid_token without explanation). Block it; the user can mint a new
// key first via POST, or delete the agent entirely if they want it inert.
export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string; keyId: string }> },
) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;

  const { id: rawAgentId, keyId: rawKeyId } = await ctx.params;
  const agentId = IdSchema.safeParse(rawAgentId);
  const keyId = IdSchema.safeParse(rawKeyId);
  if (!agentId.success || !keyId.success) return apiError("bad_request");

  // One round-trip to verify (a) the agent belongs to this user and (b)
  // count active keys, before mutating. The count includes the key we're
  // about to revoke, so "would this be the last one" = count <= 1.
  const [ownership] = await db
    .select({
      agentId: agents.id,
      activeKeyCount: sql<number>`count(${agentApiKeys.id}) filter (where ${agentApiKeys.revokedAt} is null)`.mapWith(
        Number,
      ),
    })
    .from(agents)
    .leftJoin(agentApiKeys, eq(agentApiKeys.agentId, agents.id))
    .where(and(eq(agents.id, agentId.data), eq(agents.userId, user.id)))
    .groupBy(agents.id)
    .limit(1);

  if (!ownership) return apiError("not_found");

  if (ownership.activeKeyCount <= 1) {
    return apiError(
      "bad_request",
      "Can't revoke the agent's last API key. Mint a new key before revoking this one, or delete the agent.",
    );
  }

  const [row] = await db
    .update(agentApiKeys)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(agentApiKeys.id, keyId.data),
        eq(agentApiKeys.agentId, agentId.data),
        isNull(agentApiKeys.revokedAt),
      ),
    )
    .returning({ id: agentApiKeys.id });

  if (!row) return apiError("not_found");
  return apiOk({ id: row.id, revoked: true });
}
