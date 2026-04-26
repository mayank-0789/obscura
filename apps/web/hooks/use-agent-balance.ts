"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";

export type AgentBalance = {
  amount: string; // base units (e.g. micros for 6-decimal USDC)
  decimals: number;
};

// Polls the on-chain stablecoin balance for an agent. Refetches every 10s so
// top-ups feel "live" shortly after the webhook credits the wallet. Backend
// implementation will swap to encrypted-balance reads in a later stage of
// the Umbra pivot; this hook's contract stays the same.
export function useAgentBalance(agentId: string | undefined) {
  const { status } = useSession();
  const authedFetch = useAuthedFetch();

  return useQuery<AgentBalance>({
    queryKey: ["agent-balance", agentId],
    enabled: status === "authenticated" && !!agentId,
    refetchInterval: 10_000,
    staleTime: 5_000,
    queryFn: async () => {
      const res = await authedFetch(`/api/agents/${agentId}/balance`);
      if (!res.ok) throw new Error(`api_error_${res.status}`);
      return res.json();
    },
  });
}
