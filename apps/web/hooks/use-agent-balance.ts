"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";

export type AgentBalance = {
  amount: string;
  decimals: number;
};

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
