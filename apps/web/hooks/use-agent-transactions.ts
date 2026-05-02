"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";

export type AgentTransaction = {
  id: string;
  agentId: string;
  amountUsdg: string;
  counterparty: string;
  merchantHost: string | null;
  solanaSig: string | null;
  createdAt: string;
  confirmedAt: string | null;
};

export type AgentTransactionsResponse = {
  transactions: AgentTransaction[];
  nextCursor: string | null;
};

type Options = {
  limit?: number;
  cursor?: string;
};

export function useAgentTransactions(
  agentId: string,
  options: Options = {},
) {
  const { status } = useSession();
  const authedFetch = useAuthedFetch();
  const limit = options.limit ?? 10;
  const cursor = options.cursor;

  return useQuery<AgentTransactionsResponse>({
    queryKey: ["agents", agentId, "transactions", { limit, cursor }],
    enabled: status === "authenticated" && !!agentId,
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (cursor) params.set("cursor", cursor);
      const res = await authedFetch(
        `/api/agents/${agentId}/transactions?${params.toString()}`,
      );
      if (res.status === 404) throw new Error("not_found");
      if (!res.ok) throw new Error(`api_error_${res.status}`);
      return res.json();
    },
  });
}
