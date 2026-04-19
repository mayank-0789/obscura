"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";

// Stop polling after this long. If the webhook didn't land in 5 minutes, it's
// almost certainly not going to — something else is broken and we should tell
// the user to retry rather than spin forever.
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

// Polls /api/topup/status/[paymentId] every 2s until state is terminal
// (confirmed / failed) or until POLL_TIMEOUT_MS elapses since this hook
// instance mounted. After the timeout, the query returns state='timeout'
// so the UI can show a retry prompt.
export function useTopupStatus(paymentId: string | null) {
  const { ready, authenticated } = usePrivy();
  const authedFetch = useAuthedFetch();

  // Capture mount time once — polling-cutoff should not reset on each refetch.
  const mountedAt = useMemo(() => Date.now(), []);

  return useQuery<TopupStatus>({
    queryKey: ["topup-status", paymentId],
    enabled: ready && authenticated && !!paymentId,
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
