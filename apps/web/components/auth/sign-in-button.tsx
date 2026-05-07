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
        className="h-[18px] w-24 animate-pulse bg-[#1f1f1f]"
      />
    );
  }

  if (status !== "authenticated") {
    return (
      <button
        onClick={() => signIn("google", { callbackUrl: "/onboarding" })}
        className="inline-flex items-center gap-2 border-b border-[#f5f5f5] pb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[#f5f5f5] focus-visible:outline-none focus-visible:text-[#e63946] focus-visible:border-[#e63946]"
      >
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "#e63946" }}
        />
        sign in
      </button>
    );
  }

  const identity = session?.user?.email ?? "Signed in";

  return (
    <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.16em]">
      <span className="hidden max-w-[180px] truncate normal-case tracking-normal text-[#888] md:inline">
        {identity}
      </span>
      <button
        onClick={signOut}
        className="text-[#888] hover:text-[#f5f5f5] focus-visible:outline-none focus-visible:text-[#f5f5f5]"
      >
        sign out
      </button>
    </div>
  );
}
