"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";
import type { MerchantTransactionsResponse } from "@/hooks/use-merchant-transactions";

// Page-sized hook used by /merchants/payments. Advances by pushing cursors
// onto a stack so "Back" works without refetching from the start. Each page
// is a separate React Query entry keyed by the cursor it was fetched with —
// React Query caches them individually and pagination feels instantaneous
// on re-visit.
export function useMerchantPaymentsPage(pageSize = 50) {
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([
    undefined,
  ]);
  const currentCursor = cursorStack[cursorStack.length - 1];
  const { ready, authenticated } = usePrivy();
  const authedFetch = useAuthedFetch();

  const query = useQuery<MerchantTransactionsResponse>({
    // Key shape matches `useMerchantTransactions` so a future targeted
    // invalidate (e.g. after a manual "confirm" action) hits both hooks.
    queryKey: [
      "merchant",
      "me",
      "transactions",
      { limit: pageSize, cursor: currentCursor },
    ],
    enabled: ready && authenticated,
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      if (currentCursor) params.set("cursor", currentCursor);
      const res = await authedFetch(
        `/api/merchants/me/transactions?${params.toString()}`,
      );
      if (res.status === 404) throw new Error("not_found");
      if (!res.ok) throw new Error(`api_error_${res.status}`);
      return res.json();
    },
  });

  return {
    ...query,
    pageIndex: cursorStack.length - 1,
    // Disable navigation while a refetch is in flight — prevents a rapid
    // double-click on "Next" from pushing the stale nextCursor twice and
    // desyncing the stack.
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
