"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { toast } from "sonner";

// After Privy login, upsert user via /api/auth/sync. First-timers redirect to /dashboard.
export function useSyncUser() {
  const router = useRouter();
  const { ready, authenticated, getAccessToken } = usePrivy();

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

        if (!res.ok) {
          toast.error("Sign-in sync failed", {
            description: "Your session is active. Refresh to retry.",
          });
          return;
        }

        const { isNew } = (await res.json()) as { isNew?: boolean };
        if (!cancelled && isNew) router.push("/dashboard");
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
  }, [ready, authenticated, getAccessToken, router]);
}
