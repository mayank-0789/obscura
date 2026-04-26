"use client";

import { useCallback } from "react";
import { signOut as nextAuthSignOut } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LAST_ROLE_KEY, ONBOARDED_KEY } from "@/lib/onboarding";

// Module-level flag so that multiple simultaneous triggers (e.g. useUser +
// useAgents both hitting 401 on the same render) collapse into a single
// sign-out flow. Reset when the flow completes, win or lose.
let signingOut = false;

// Single source of truth for signing a user out. Order matters:
// 1) server ack (records last-seen; non-fatal if it fails)
// 2) clear TanStack cache so the next session doesn't reuse stale data
// 3) clear per-user localStorage
// 4) NextAuth signOut — clears session cookie + redirects to "/"
export function useSignout() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    if (signingOut) return;
    signingOut = true;
    try {
      // Best-effort: server ack (cookie travels automatically). Failure is
      // non-fatal — the cookie clear below is what actually signs the user out.
      await fetch("/api/auth/signout", { method: "POST" }).catch(() => undefined);

      queryClient.clear();
      if (typeof window !== "undefined") {
        localStorage.removeItem(ONBOARDED_KEY);
        localStorage.removeItem(LAST_ROLE_KEY);
      }
      // NextAuth handles cookie clearing + redirect.
      await nextAuthSignOut({ callbackUrl: "/" });
    } catch (err) {
      console.error("[signout]", err);
      toast.error("Sign-out failed", { description: "Please try again." });
    } finally {
      signingOut = false;
    }
  }, [queryClient]);
}
