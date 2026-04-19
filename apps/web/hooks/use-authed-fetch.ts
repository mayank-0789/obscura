"use client";

import { useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSignout } from "@/hooks/use-signout";

export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "UnauthorizedError";
  }
}

// Auth-aware fetch. Injects `Authorization: Bearer <privy-token>` automatically;
// any 401 (or missing token) is treated as session death and triggers a full
// sign-out before the caller sees the error. Non-auth failures (4xx / 5xx)
// pass through so the caller can handle domain-specific cases.
//
// Every hook that talks to our API uses this — it's the only way a new hook
// can stay consistent with the app-wide "401 ⇒ sign out" contract.
export function useAuthedFetch() {
  const { getAccessToken } = usePrivy();
  const signOut = useSignout();

  return useCallback(
    async (path: string, init?: RequestInit): Promise<Response> => {
      const token = await getAccessToken();
      if (!token) {
        void signOut();
        throw new UnauthorizedError();
      }

      const headers = new Headers(init?.headers);
      headers.set("Authorization", `Bearer ${token}`);
      if (init?.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      const res = await fetch(path, { ...init, headers });
      if (res.status === 401) {
        void signOut();
        throw new UnauthorizedError();
      }
      return res;
    },
    [getAccessToken, signOut],
  );
}
