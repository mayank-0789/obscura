"use client";

import { useQuery } from "@tanstack/react-query";
import { usePrivy } from "@privy-io/react-auth";
import type { User } from "@payrail/db";

export type MeResponse = {
  user: User;
  solanaWallet: { id: string; address: string } | null;
};

// Fetches user + wallet from /api/me. Retries 404 (sync race) up to 3× with backoff.
export function useUser() {
  const { ready, authenticated, getAccessToken } = usePrivy();

  return useQuery<MeResponse>({
    queryKey: ["me"],
    enabled: ready && authenticated,
    staleTime: 60_000,
    retry: (count, err) =>
      err instanceof Error && err.message === "user_not_synced" && count < 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error("no_token");

      const res = await fetch("/api/me", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 404) throw new Error("user_not_synced");
      if (!res.ok) throw new Error(`api_error_${res.status}`);
      return res.json();
    },
  });
}
