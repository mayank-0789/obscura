"use client";

import { useCallback } from "react";
import { signOut as nextAuthSignOut } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LAST_ROLE_KEY, ONBOARDED_KEY } from "@/lib/onboarding";

// Collapses concurrent 401-triggered sign-outs into a single flow.
let signingOut = false;

// Order: server ack → cache clear → localStorage → NextAuth cookie/redirect.
export function useSignout() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    if (signingOut) return;
    signingOut = true;
    try {
      await fetch("/api/auth/signout", { method: "POST" }).catch(() => undefined);

      queryClient.clear();
      if (typeof window !== "undefined") {
        localStorage.removeItem(ONBOARDED_KEY);
        localStorage.removeItem(LAST_ROLE_KEY);
      }
      await nextAuthSignOut({ callbackUrl: "/" });
    } catch (err) {
      console.error("[signout]", err);
      toast.error("Sign-out failed", { description: "Please try again." });
    } finally {
      signingOut = false;
    }
  }, [queryClient]);
}
