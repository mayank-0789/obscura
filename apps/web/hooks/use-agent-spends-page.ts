"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";
import type { AgentTransactionsResponse } from "@/hooks/use-agent-transactions";

// Page-sized hook for /agents/[id]/spends. Stack-based cursor navigation so
// Prev works without refetching from the start. Mirrors
// `useMerchantPaymentsPage` — same UX contract for an agent-dev viewing
// their outgoing payment history.
export function useAgentSpendsPage(agentId: string, pageSize = 50) {
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([
    undefined,
  ]);
  const currentCursor = cursorStack[cursorStack.length - 1];
  const { ready, authenticated } = usePrivy();
  const authedFetch = useAuthedFetch();

  const query = useQuery<AgentTransactionsResponse>({
    queryKey: [
      "agents",
      agentId,
      "transactions",
      { limit: pageSize, cursor: currentCursor },
    ],
    enabled: ready && authenticated && !!agentId,
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      if (currentCursor) params.set("cursor", currentCursor);
      const res = await authedFetch(
        `/api/agents/${agentId}/transactions?${params.toString()}`,
      );
      if (res.status === 404) throw new Error("not_found");
      if (!res.ok) throw new Error(`api_error_${res.status}`);
      return res.json();
    },
  });

  return {
    ...query,
    pageIndex: cursorStack.length - 1,
    // Disable nav while fetching so double-clicks can't desync the cursor
    // stack. Same pattern as useMerchantPaymentsPage.
    canGoNext: !!query.data?.nextCursor && !query.isFetching,
    canGoPrev: cursorStack.length > 1 && !query.isFetching,
    goNext: () => {
      if (query.isFetching) return;
      const next = query.data?.nextCursor;
      if (!next) return;
      setCursorStack((s) => [...s, next]);
    },
    goPrev: () => {
      if (query.isFetching) return;
      setCursorStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
    },
    resetToStart: () => {
      setCursorStack([undefined]);
    },
  };
}
