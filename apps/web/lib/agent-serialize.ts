import "server-only";
import type { Agent, Budget } from "@/lib/db";
import type { AgentDTO } from "@/types/agent";

type BudgetSnapshot = Pick<Budget, "period" | "capInr" | "capUsdg" | "spentUsdg">;

/** DB row → wire. bigints stringified, Date → ISO. */
export function serializeAgent(
  agent: Agent,
  budget: BudgetSnapshot | null,
): AgentDTO {
  return {
    id: agent.id,
    name: agent.name,
    etaAddress: agent.etaAddress,
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
