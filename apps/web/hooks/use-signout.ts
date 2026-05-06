"use client";

import { useCallback } from "react";
import { signOut as nextAuthSignOut } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LAST_ROLE_KEY, ONBOARDED_KEY } from "@/lib/onboarding";

// Collapses concurrent 401-triggered sign-outs into a single flow.
let signingOut = false;

// Order: cache clear → localStorage → NextAuth cookie/redirect.
// Audit (users.updated_at bump) lives in events.signOut in lib/auth-config.ts —
// must NOT be a custom POST /api/auth/signout, which would shadow Auth.js's
// own cookie-clearing handler.
export function useSignout() {
  const queryClient = useQueryClient();

  return useCallback(async () => {
    if (signingOut) return;
    signingOut = true;
    try {
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
