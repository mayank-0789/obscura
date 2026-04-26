"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";
import type { AgentDTO } from "@/types/agent";

// Lists the current user's agents. Shares its queryKey with use-create-agent
// so new agents appear the moment the mutation resolves.
export function useAgents() {
  const { status } = useSession();
  const authedFetch = useAuthedFetch();

  return useQuery<AgentDTO[]>({
    queryKey: ["agents"],
    enabled: status === "authenticated",
    staleTime: 30_000,
    queryFn: async () => {
      const res = await authedFetch("/api/agents");
      if (!res.ok) throw new Error(`api_error_${res.status}`);
      const json = (await res.json()) as { agents: AgentDTO[] };
      return json.agents;
    },
  });
}
