"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import {
  ONBOARDED_KEY,
  destinationForRole,
  type Role,
} from "@/lib/onboarding";

// Post-auth routing: no role → /onboarding; onboarded → role dashboard;
// otherwise → /onboarding for one-time per-device re-confirmation.
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
