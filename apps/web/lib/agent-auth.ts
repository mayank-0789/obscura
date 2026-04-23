import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import {
  db,
  agents,
  agentApiKeys,
  budgets,
  type Agent,
  type Budget,
} from "@/lib/db";
import { hashAgentApiKey } from "@/lib/agent-keys";
import { apiError } from "@/lib/api";

export type AgentAuthErrorCode =
  | "missing_token"
  | "invalid_token"
  | "agent_inactive";

export class AgentAuthError extends Error {
  constructor(public readonly code: AgentAuthErrorCode) {
    super(code);
    this.name = "AgentAuthError";
  }
}

export type AuthedAgentContext = {
  agent: Agent;
  budget: Budget;
};

// Resolves a caller from the Bearer API key header. Scoped specifically to
// agent-authenticated routes (/api/x402/sign, and future agent-facing RPCs).
// Different from lib/auth.ts which expects a user JWT.
//
// Returns { agent, budget } or throws AgentAuthError. We eagerly load the
// budget in the same query because every caller of this helper needs it for
// spend-cap checks.
export async function requireAgentApiKey(
  req: Request,
): Promise<AuthedAgentContext> {
  const token = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!token) throw new AgentAuthError("missing_token");

  const keyHash = hashAgentApiKey(token);

  const rows = await db
    .select({ agent: agents, budget: budgets })
    .from(agentApiKeys)
    .innerJoin(agents, eq(agents.id, agentApiKeys.agentId))
    .innerJoin(budgets, eq(budgets.agentId, agents.id))
    .where(
      and(eq(agentApiKeys.keyHash, keyHash), isNull(agentApiKeys.revokedAt)),
    )
    .limit(1);

  const row = rows[0];
  if (!row) throw new AgentAuthError("invalid_token");

  if (row.agent.status !== "active") {
    throw new AgentAuthError("agent_inactive");
  }

  return { agent: row.agent, budget: row.budget };
}

// Same pattern as authGuard — one-line ergonomics in routes:
//   const ctx = await agentAuthGuard(req); if (ctx instanceof Response) return ctx;
export async function agentAuthGuard(
  req: Request,
): Promise<AuthedAgentContext | Response> {
  try {
    return await requireAgentApiKey(req);
  } catch (err) {
    if (err instanceof AgentAuthError) return apiError(err.code);
    throw err;
  }
}
