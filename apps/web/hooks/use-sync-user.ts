"use client";

import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
import { useAuthedFetch, UnauthorizedError } from "@/hooks/use-authed-fetch";

// Idempotent POST to /api/auth/sync whenever a Privy session becomes ready.
// Redirects are handled by useLogin's onComplete — this hook only cares about
// DB state. 401 is already handled inside useAuthedFetch (force sign-out),
// so we only need to toast for transient non-auth failures.
export function useSyncUser() {
  const { ready, authenticated } = usePrivy();
  const authedFetch = useAuthedFetch();

  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;

    void (async () => {
      try {
        const res = await authedFetch("/api/auth/sync", { method: "POST" });
        if (cancelled || res.ok) return;
        toast.error("Sign-in sync failed", {
          description: "Your session is active. Refresh to retry.",
        });
      } catch (err) {
        if (cancelled || err instanceof UnauthorizedError) return;
        toast.error("Sign-in sync failed", {
          description: "Check your connection and refresh.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, authedFetch]);
}
