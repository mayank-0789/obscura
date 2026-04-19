"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";
import type { AgentDTO } from "@/types/agent";

// Lists the current user's agents. Shares its queryKey with use-create-agent
// so new agents appear the moment the mutation resolves.
export function useAgents() {
  const { ready, authenticated } = usePrivy();
  const authedFetch = useAuthedFetch();

  return useQuery<AgentDTO[]>({
    queryKey: ["agents"],
    enabled: ready && authenticated,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await authedFetch("/api/agents");
      if (!res.ok) throw new Error(`api_error_${res.status}`);
      const json = (await res.json()) as { agents: AgentDTO[] };
      return json.agents;
    },
  });
}
