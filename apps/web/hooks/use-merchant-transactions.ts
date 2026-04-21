"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";

export type MerchantTransaction = {
  id: string;
  agentId: string;
  amountUsdg: string;
  counterparty: string;
  merchantHost: string | null;
  solanaSig: string | null;
  createdAt: string;
  confirmedAt: string | null;
};

export type MerchantTransactionsResponse = {
  transactions: MerchantTransaction[];
  nextCursor: string | null;
};

type Options = {
  limit?: number;
  cursor?: string;
};

// Cursor-paginated list of confirmed earnings for the authenticated merchant.
// The dashboard calls this with limit=10 (recent feed); the full /payments
// page will pass limit=50 + cursor for pagination. Polls at the same 10s
// cadence as useMerchant so stats and feed stay visually in sync.
export function useMerchantTransactions(options: Options = {}) {
  const { ready, authenticated } = usePrivy();
  const authedFetch = useAuthedFetch();
  const limit = options.limit ?? 10;
  const cursor = options.cursor;

  return useQuery<MerchantTransactionsResponse>({
    queryKey: ["merchant", "me", "transactions", { limit, cursor }],
    enabled: ready && authenticated,
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: false,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      if (cursor) params.set("cursor", cursor);
      const res = await authedFetch(
        `/api/merchants/me/transactions?${params.toString()}`,
      );
      if (res.status === 404) throw new Error("not_found");
      if (!res.ok) throw new Error(`api_error_${res.status}`);
      return res.json();
    },
  });
}
