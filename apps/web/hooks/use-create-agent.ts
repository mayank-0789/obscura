"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";
import type { AgentDTO } from "@/types/agent";

export type CreateAgentInput = {
  name: string;
  monthlyCapInr: number;
};

export type CreateAgentResult = {
  agent: AgentDTO;
  rateSnapshot: number;
  apiKey: string;
};

// Caller must surface plaintext apiKey on success; it's not recoverable.
export function useCreateAgent() {
  const authedFetch = useAuthedFetch();
  const queryClient = useQueryClient();

  return useMutation<CreateAgentResult, Error, CreateAgentInput>({
    mutationFn: async (input) => {
      const res = await authedFetch("/api/agents", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(error ?? `api_error_${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}
