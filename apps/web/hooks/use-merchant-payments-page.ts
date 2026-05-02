"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";
import type { MerchantTransactionsResponse } from "@/hooks/use-merchant-transactions";

// Stack-based cursor pager so Back works without refetching from start.
export function useMerchantPaymentsPage(pageSize = 50) {
  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([
    undefined,
  ]);
  const currentCursor = cursorStack[cursorStack.length - 1];
  const { status } = useSession();
  const authedFetch = useAuthedFetch();

  const query = useQuery<MerchantTransactionsResponse>({
    queryKey: [
      "merchant",
      "me",
      "transactions",
      { limit: pageSize, cursor: currentCursor },
    ],
    enabled: status === "authenticated",
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
