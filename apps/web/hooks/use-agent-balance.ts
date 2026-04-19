"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";

export type AgentBalance = {
  amount: string; // base units (e.g. micros for 6-decimal USDC)
  decimals: number;
};

// Polls the on-chain stablecoin balance for an agent via Helius. Refetches
// every 10s so top-ups feel "live" shortly after the webhook credits the
// wallet — no manual refresh needed.
export function useAgentBalance(agentId: string | undefined) {
  const { ready, authenticated } = usePrivy();
  const authedFetch = useAuthedFetch();

  return useQuery<AgentBalance>({
    queryKey: ["agent-balance", agentId],
    enabled: ready && authenticated && !!agentId,
    refetchInterval: 10_000,
    staleTime: 5_000,
    queryFn: async () => {
      const res = await authedFetch(`/api/agents/${agentId}/balance`);
      if (!res.ok) throw new Error(`api_error_${res.status}`);
      return res.json();
    },
  });
}
