"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useAuthedFetch, UnauthorizedError } from "@/hooks/use-authed-fetch";

// Idempotent POST to /api/auth/sync whenever a NextAuth session becomes ready.
// Redirects are handled by the post-login flow — this hook only cares about
// DB state. 401 is already handled inside useAuthedFetch (force sign-out),
// so we only need to toast for transient non-auth failures.
//
// syncedRef guards against React strict-mode double-invokes and rapid remounts
// (e.g. SignInButton renders on every page, so each route change would
// otherwise re-fire sync). The upsert is DB-idempotent; this just spares a
// round-trip.
export function useSyncUser() {
  const { status } = useSession();
  const authedFetch = useAuthedFetch();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (status !== "authenticated") {
      syncedRef.current = false;
      return;
    }
    if (syncedRef.current) return;
    syncedRef.current = true;

    let cancelled = false;

    void (async () => {
      try {
        const res = await authedFetch("/api/auth/sync", { method: "POST" });
        if (cancelled || res.ok) return;
        syncedRef.current = false; // allow retry on refresh / next mount
        toast.error("Sign-in sync failed", {
          description: "Your session is active. Refresh to retry.",
        });
      } catch (err) {
        if (cancelled || err instanceof UnauthorizedError) return;
        syncedRef.current = false;
        toast.error("Sign-in sync failed", {
          description: "Check your connection and refresh.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, authedFetch]);
}
