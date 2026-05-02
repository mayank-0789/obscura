"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuthedFetch, UnauthorizedError } from "@/hooks/use-authed-fetch";

// Idempotent /api/auth/sync. syncedRef collapses strict-mode double-invokes
// and rapid remounts. Success invalidates ["me"] so consumers that 404'd
// during the Auth.js v5 token.sub sync race recover without a hard refresh.
export function useSyncUser() {
  const { status } = useSession();
  const authedFetch = useAuthedFetch();
  const queryClient = useQueryClient();
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
        if (cancelled) return;
        if (res.ok) {
          void queryClient.invalidateQueries({ queryKey: ["me"] });
          return;
        }
        syncedRef.current = false;
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
  }, [status, authedFetch, queryClient]);
}
