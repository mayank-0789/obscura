"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";

export type MerchantMeResponse = {
  merchant: {
    id: string;
    name: string | null;
    etaAddress: string;
    createdAt: string;
  };
  stats: {
    callsCount: number;
    uniquePayersCount: number;
    totalEarnedUsdg: string;
    thisMonthEarnedUsdg: string;
  };
};

// 404 surfaces as `not_found` without retry so the merchant dashboard can
// show its register CTA instead of waiting for a doomed retry.
export function useMerchant() {
  const { status } = useSession();
  const authedFetch = useAuthedFetch();

  return useQuery<MerchantMeResponse>({
    queryKey: ["merchant", "me"],
    enabled: status === "authenticated",
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
