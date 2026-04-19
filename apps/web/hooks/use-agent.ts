"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";
import type { AgentDTO } from "@/types/agent";

// Fetches a single agent by id. 404 surfaces as Error("not_found") so the
// detail page can render a dedicated not-found UI instead of a generic error.
export function useAgent(id: string) {
  const { ready, authenticated } = usePrivy();
  const authedFetch = useAuthedFetch();

  return useQuery<AgentDTO>({
    queryKey: ["agents", id],
    enabled: ready && authenticated && !!id,
    staleTime: 30_000,
    retry: (count, err) =>
      count < 1 && !(err instanceof Error && err.message === "not_found"),
    queryFn: async () => {
      const res = await authedFetch(`/api/agents/${id}`);
      if (res.status === 404) throw new Error("not_found");
      if (!res.ok) throw new Error(`api_error_${res.status}`);
      const json = (await res.json()) as { agent: AgentDTO };
      return json.agent;
    },
  });
}
