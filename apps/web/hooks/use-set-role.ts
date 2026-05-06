"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { User } from "@obscura-app/db";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";
import { parseApiError } from "@/lib/parse-api-error";
import type { Role } from "@/lib/onboarding";

type SetRoleResponse = {
  user: User;
  merchant: {
    id: string;
    etaAddress: string;
    name: string | null;
    createdAt: string;
  } | null;
  merchantCreated: boolean;
  // Plaintext key returned once on creation; null on idempotent re-call.
  apiKey: string | null;
};

export function useSetRole() {
  const authedFetch = useAuthedFetch();
  const queryClient = useQueryClient();

  return useMutation<SetRoleResponse, Error, Role>({
    mutationFn: async (role) => {
      const res = await authedFetch("/api/onboarding/role", {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      return res.json();
    },
    // Seed caches so post-navigation reads aren't stale `me` + 404 /merchants/me.
    onSuccess: (data) => {
      queryClient.setQueryData(["me"], { user: data.user });
      if (data.merchant) {
        queryClient.setQueryData(["merchant", "me"], {
          merchant: data.merchant,
          stats: {
            callsCount: 0,
            uniquePayersCount: 0,
            totalEarnedUsdg: "0",
            thisMonthEarnedUsdg: "0",
          },
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["merchant", "me"] });
    },
  });
}
