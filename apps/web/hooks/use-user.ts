"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import type { User } from "@payrail-app/db";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";

export type MeResponse = {
  user: User;
};

// Fetches user from /api/me. Retries 404 (sync race) up to 3× with backoff.
// 401 is handled by useAuthedFetch — it forces a sign-out, so we don't retry
// or render stale state here.
export function useUser() {
  const { status } = useSession();
  const authedFetch = useAuthedFetch();

  return useQuery<MeResponse>({
    queryKey: ["me"],
    enabled: status === "authenticated",
    staleTime: 60_000,
    retry: (count, err) =>
      err instanceof Error && err.message === "user_not_synced" && count < 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    queryFn: async () => {
      const res = await authedFetch("/api/me");
      if (res.status === 404) throw new Error("user_not_synced");
      if (!res.ok) throw new Error(`api_error_${res.status}`);
      return res.json();
    },
  });
}
