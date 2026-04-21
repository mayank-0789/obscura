"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LAST_ROLE_KEY, ONBOARDED_KEY } from "@/lib/onboarding";

// Module-level flag so that multiple simultaneous triggers (e.g. useUser +
// useAgents both hitting 401 on the same render) collapse into a single
// sign-out flow. Reset when the flow completes, win or lose, so a genuine
// re-signout later isn't blocked.
let signingOut = false;

// Single source of truth for signing a user out. Order matters:
// 1) server ack (records last-seen; non-fatal if it fails)
// 2) clear TanStack cache so the next session doesn't reuse stale data
// 3) Privy logout — clears cookies + in-memory session
// 4) redirect home
export function useSignout() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { logout, getAccessToken } = usePrivy();

  return useCallback(async () => {
    if (signingOut) return;
    signingOut = true;
    try {
      const token = await getAccessToken().catch(() => null);
      if (token) {
        await fetch("/api/auth/signout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => undefined);
      }

      queryClient.clear();
      // Clear per-user localStorage so the next signup on this device
      // doesn't inherit the previous user's onboarding flag or last-used
      // dashboard side.
      if (typeof window !== "undefined") {
        localStorage.removeItem(ONBOARDED_KEY);
        localStorage.removeItem(LAST_ROLE_KEY);
      }
      await logout();
      router.push("/");
    } catch (err) {
      console.error("[signout]", err);
      toast.error("Sign-out failed", { description: "Please try again." });
    } finally {
      signingOut = false;
    }
  }, [getAccessToken, logout, queryClient, router]);
}
