"use client";

import { useCallback } from "react";
import { useSignout } from "@/hooks/use-signout";

export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
    this.name = "UnauthorizedError";
  }
}

// Auth-aware fetch. Under NextAuth the session is carried by an HttpOnly
// cookie that the browser includes automatically on same-origin requests, so
// we don't inject any Authorization header here. We DO still treat 401 as
// session death and trigger a clean sign-out before the caller sees the
// error — that contract is the point of going through this wrapper.
//
// Every hook that talks to our API uses this so the app-wide
// "401 ⇒ sign out" behaviour stays consistent.
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
