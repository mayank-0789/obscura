"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
    try {
      const token = await getAccessToken().catch(() => null);
      if (token) {
        await fetch("/api/auth/signout", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => undefined);
      }

      queryClient.clear();
      await logout();
      router.push("/");
    } catch (err) {
      console.error("[signout]", err);
      toast.error("Sign-out failed", { description: "Please try again." });
    }
  }, [getAccessToken, logout, queryClient, router]);
}
