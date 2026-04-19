"use client";

import { useRouter } from "next/navigation";
import { usePrivy, useLogin } from "@privy-io/react-auth";
import { toast } from "sonner";
import { useSyncUser } from "@/hooks/use-sync-user";
import { useSignout } from "@/hooks/use-signout";

export function SignInButton() {
  const router = useRouter();
  const { ready, authenticated, user } = usePrivy();
  const signOut = useSignout();
  useSyncUser();

  // Drive the post-auth redirect from Privy's own event so first-login users
  // land on /dashboard without an effect-based flicker.
  const { login } = useLogin({
    onComplete: ({ wasAlreadyAuthenticated }) => {
      if (wasAlreadyAuthenticated) return;
      router.push("/dashboard");
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
        onClick={signOut}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-zinc-800"
      >
        Sign out
      </button>
    </div>
  );
}
