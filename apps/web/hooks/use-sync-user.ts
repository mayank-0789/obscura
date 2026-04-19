"use client";

import { useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";
import { useSignout } from "@/hooks/use-signout";

// Idempotent POST to /api/auth/sync whenever the Privy session becomes ready.
// Redirects are handled by useLogin's onComplete — this hook only cares about DB state.
// 401 from the server means our JWT no longer verifies; force a clean sign-out.
export function useSyncUser() {
  const { ready, authenticated, getAccessToken } = usePrivy();
  const signOut = useSignout();

  useEffect(() => {
    if (!ready || !authenticated) return;
    let cancelled = false;

    void (async () => {
      const token = await getAccessToken();
      if (!token || cancelled) return;

      try {
        const res = await fetch("/api/auth/sync", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;

        if (res.status === 401) {
          await signOut();
          return;
        }

        if (!res.ok) {
          toast.error("Sign-in sync failed", {
            description: "Your session is active. Refresh to retry.",
          });
        }
      } catch {
        if (!cancelled) {
          toast.error("Sign-in sync failed", {
            description: "Check your connection and refresh.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, getAccessToken, signOut]);
}
