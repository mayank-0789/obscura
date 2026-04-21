"use client";

import { useRef } from "react";
import { usePrivy, useLogin } from "@privy-io/react-auth";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type { MeResponse } from "@/hooks/use-user";
import { useSyncUser } from "@/hooks/use-sync-user";
import { useSignout } from "@/hooks/use-signout";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";
import { usePostAuthRouter } from "@/hooks/use-post-auth-router";
import { type Role } from "@/lib/onboarding";

// Single component that owns the `onComplete` callback for Privy login.
// CtaLink also mounts `useLogin` but only to trigger `login()` — it passes
// no callbacks. This keeps post-login routing deterministic: exactly one
// `router.push` fires per login, via `usePostAuthRouter`, driven by role +
// `ONBOARDED_KEY` only (no hidden intent signals).
export function SignInButton() {
  const { ready, authenticated, user } = usePrivy();
  const signOut = useSignout();
  const queryClient = useQueryClient();
  const authedFetch = useAuthedFetch();
  const postAuthRoute = usePostAuthRouter();
  const completingRef = useRef(false);
  useSyncUser();

  const { login } = useLogin({
    onComplete: async ({ wasAlreadyAuthenticated }) => {
      if (wasAlreadyAuthenticated) return;
      if (completingRef.current) return;
      completingRef.current = true;
      try {
        // Privy's login finishes BEFORE our /api/auth/sync POST runs (it's
        // fired by useSyncUser on the next render). To route by role we
        // need the users row. Fetch /api/me ourselves with a short retry so
        // routing doesn't sprint ahead of sync.
        const me = await fetchMeWithRetry(authedFetch);
        const role = me?.user.role as Role | undefined;
        // Seed the shared cache so useUser consumers render without a
        // second round-trip on the next page.
        if (me) queryClient.setQueryData(["me"], me);
        postAuthRoute(role);
      } finally {
        completingRef.current = false;
      }
    },
    onError: (code) => {
      if (code === "exited_auth_flow") return;
      toast.error("Sign-in failed", { description: code });
    },
  });

  if (!ready) {
    return (
      <div
        aria-hidden
        className="h-8 w-20 animate-pulse rounded-md bg-zinc-800/60"
      />
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={() => login()}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
      >
        Sign in
      </button>
    );
  }

  const identity =
    user?.email?.address ??
    user?.google?.email ??
    user?.phone?.number ??
    (user ? `${user.id.slice(0, 10)}…` : "Signed in");

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="hidden max-w-[180px] truncate text-zinc-400 md:inline">
        {identity}
      </span>
      <button
        onClick={signOut}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
      >
        Sign out
      </button>
    </div>
  );
}

// Short-retry /me fetch to absorb the sync race: Privy onComplete runs
// before /api/auth/sync has inserted the users row. Back off with a few
// attempts (200ms × 4 = ~1s worst case). If sync eventually fails, we fall
// through with no data and postAuthRoute sends the user to onboarding —
// which will re-trigger sync via its own useSyncUser mount.
async function fetchMeWithRetry(
  authedFetch: (path: string, init?: RequestInit) => Promise<Response>,
): Promise<MeResponse | null> {
  const delays = [0, 200, 400, 600];
  for (const delay of delays) {
    if (delay > 0) await sleep(delay);
    try {
      const res = await authedFetch("/api/me");
      if (res.ok) return (await res.json()) as MeResponse;
      if (res.status !== 404) return null;
    } catch {
      return null;
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
