"use client";

import { useMutation } from "@tanstack/react-query";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";

export type CreateTopupSessionInput = {
  agentId: string;
  amountInr: number;
};

export type CreateTopupSessionResult = {
  checkoutUrl: string;
  sessionId: string;
};

// Creates a Dodo checkout session for a top-up. On success the caller should
// redirect the browser to `checkoutUrl` — Dodo handles the rest.
export function useCreateTopupSession() {
  const authedFetch = useAuthedFetch();

  return useMutation<CreateTopupSessionResult, Error, CreateTopupSessionInput>({
    mutationFn: async (input) => {
      const res = await authedFetch("/api/topup/session", {
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
  });
}
