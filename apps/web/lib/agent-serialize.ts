import "server-only";
import type { Agent, Budget } from "@/lib/db";
import type { AgentDTO } from "@/types/agent";

type BudgetSnapshot = Pick<Budget, "period" | "capInr" | "capUsdg" | "spentUsdg">;

// DB rows → wire shape. bigints are stringified (JSON.stringify doesn't handle
// them); Date becomes ISO string via toJSON(). Every agent response goes through
// this so the wire contract lives in exactly one place.
export function serializeAgent(
  agent: Agent,
  budget: BudgetSnapshot | null,
): AgentDTO {
  return {
    id: agent.id,
    name: agent.name,
    publicKey: agent.publicKey,
    privyWalletId: agent.privyWalletId,
    status: agent.status,
    createdAt: agent.createdAt.toISOString(),
    budget: budget
      ? {
          period: budget.period,
          capInr: budget.capInr.toString(),
          capUsdg: budget.capUsdg.toString(),
          spentUsdg: budget.spentUsdg.toString(),
        }
      : null,
  };
}
