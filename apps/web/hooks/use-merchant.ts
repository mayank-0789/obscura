"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";

export type MerchantMeResponse = {
  merchant: {
    id: string;
    name: string | null;
    payoutWallet: string;
    createdAt: string;
  };
  stats: {
    callsCount: number;
    uniquePayersCount: number;
    totalEarnedUsdg: string;
    thisMonthEarnedUsdg: string;
  };
};

// Fetches the authenticated merchant's identity + aggregate stats from
// /api/merchants/me. Polls every 10s so the dashboard trails reality even
// without the SSE push (Phase 11 adds real-time invalidation on top of this
// polling baseline).
//
// 404 is surfaced as `not_found` without retry — the caller (merchant
// dashboard) uses it to detect "you reached a merchant page without a
// merchant record" and show a register CTA. Retrying would re-hit the same
// 404 and just delay the UI's recovery path.
export function useMerchant() {
  const { ready, authenticated } = usePrivy();
  const authedFetch = useAuthedFetch();

  return useQuery<MerchantMeResponse>({
    queryKey: ["merchant", "me"],
    enabled: ready && authenticated,
    refetchInterval: 10_000,
    staleTime: 5_000,
    retry: false,
    queryFn: async () => {
      const res = await authedFetch("/api/merchants/me");
      if (res.status === 404) throw new Error("not_found");
      if (!res.ok) throw new Error(`api_error_${res.status}`);
      return res.json();
    },
  });
}
