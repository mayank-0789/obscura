"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";
import type { AgentDTO } from "@/types/agent";

// Shares queryKey with use-create-agent for instant new-agent appearance.
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
