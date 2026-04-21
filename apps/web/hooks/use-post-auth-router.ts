"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import {
  ONBOARDED_KEY,
  destinationForRole,
  type Role,
} from "@/lib/onboarding";

// Centralised post-authentication routing decision. Called by SignInButton
// after a Privy login completes.
//
// Rules (no magic, no intent stashing):
//   1. Role unresolved (fresh signup mid-sync, /me still loading) → /onboarding.
//   2. Onboarded on this device already → role-matched dashboard.
//   3. Otherwise (returning user, new device) → /onboarding. One-time
//      explicit re-confirmation per device.
//
// Role upgrades (agent-only user who wants to add the merchant side, or
// vice versa) happen from the authed product's user-menu dropdown —
// NOT via landing-page CTAs with hidden intent. Cleaner mental model,
// smaller surface area.
export function usePostAuthRouter() {
  const router = useRouter();

  return useCallback(
    (role: Role | undefined) => {
      if (typeof window === "undefined") return;

      if (!role) {
        router.push("/onboarding");
        return;
      }

      const onboarded = localStorage.getItem(ONBOARDED_KEY) === "1";
      if (!onboarded) {
        router.push("/onboarding");
        return;
      }

      router.push(destinationForRole(role));
    },
    [router],
  );
}
