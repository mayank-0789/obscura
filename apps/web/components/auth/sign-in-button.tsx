"use client";

import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useSyncUser } from "@/hooks/use-sync-user";

export function SignInButton() {
  const router = useRouter();
  const { ready, authenticated, user, login, logout } = usePrivy();
  useSyncUser();

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
        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800"
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
        onClick={async () => {
          await logout();
          router.push("/");
        }}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-zinc-800"
      >
        Sign out
      </button>
    </div>
  );
}
