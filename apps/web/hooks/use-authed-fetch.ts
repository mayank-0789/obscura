"use client";

import { useCallback } from "react";
import { useSignout } from "@/hooks/use-signout";

export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "UnauthorizedError";
  }
}

// 401 ⇒ clean sign-out before caller sees the error (app-wide contract).
export function useAuthedFetch() {
  const signOut = useSignout();

  return useCallback(
    async (path: string, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers);
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
    [signOut],
  );
}
