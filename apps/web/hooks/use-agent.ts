"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";
import type { AgentDTO } from "@/types/agent";

// 404 surfaces as Error("not_found") so the page can render dedicated UI.
export function useAgent(id: string) {
  const { status } = useSession();
  const authedFetch = useAuthedFetch();

  return useQuery<AgentDTO>({
    queryKey: ["agents", id],
    enabled: status === "authenticated" && !!id,
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
