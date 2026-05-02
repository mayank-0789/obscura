"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";

// 5min cutoff: if the webhook hasn't landed by then, surface retry over spin.
const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_INTERVAL_MS = 2_000;

export type TopupStatus =
  | { state: "pending" }
  | { state: "timeout" }
  | {
      state: "confirmed" | "failed";
      amountUsdg: string;
      amountInr: string | null;
      solanaSig: string | null;
      agentId: string;
      agentName: string;
    };

export function useTopupStatus(paymentId: string | null) {
  const { status } = useSession();
  const authedFetch = useAuthedFetch();

  // Capture mount time once so polling-cutoff doesn't reset on each refetch.
  const mountedAt = useMemo(() => Date.now(), []);

  return useQuery<TopupStatus>({
    queryKey: ["topup-status", paymentId],
    enabled: status === "authenticated" && !!paymentId,
    refetchInterval: (query) => {
      const state = query.state.data?.state;
      if (state === "confirmed" || state === "failed" || state === "timeout") {
        return false;
      }
      return POLL_INTERVAL_MS;
    },
    staleTime: 0,
    queryFn: async () => {
      if (Date.now() - mountedAt > POLL_TIMEOUT_MS) {
        return { state: "timeout" } as const;
      }

      const res = await authedFetch(`/api/topup/status/${paymentId}`);
      if (!res.ok) throw new Error(`api_error_${res.status}`);
      return res.json();
    },
  });
}
