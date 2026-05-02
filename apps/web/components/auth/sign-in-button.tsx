"use client";

import { useSession, signIn } from "next-auth/react";
import { useSyncUser } from "@/hooks/use-sync-user";
import { useSignout } from "@/hooks/use-signout";

export function SignInButton() {
  const { data: session, status } = useSession();
  const signOut = useSignout();
  useSyncUser();

  if (status === "loading") {
    return (
      <div
        aria-hidden
        className="h-8 w-20 animate-pulse rounded-md bg-zinc-800/60"
      />
    );
  }

  if (status !== "authenticated") {
    return (
      <button
        onClick={() => signIn("google", { callbackUrl: "/onboarding" })}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
      >
        Sign in
      </button>
    );
  }

  const identity = session?.user?.email ?? "Signed in";

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
