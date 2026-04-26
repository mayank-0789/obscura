"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { useUser } from "@/hooks/use-user";
import { LAST_ROLE_KEY, type Role } from "@/lib/onboarding";

type Props = {
  // Which side of the rail this CTA is selling. Only consulted for
  // already-authenticated users — to decide which dashboard to jump to.
  // Unauthed clicks just open the login flow; post-login routing is
  // role-based (handled by /onboarding).
  dashboard: "agent" | "merchant";
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "inline";
  arrow?: "→" | "↗";
  className?: string;
};

// Landing-page CTA. Behaviour:
//
//   unauthed                       → NextAuth Google sign-in with
//                                    callbackUrl=/onboarding. The onboarding
//                                    page handles role/ONBOARDED routing.
//
//   authed + role covers dashboard → direct-nav to matching dashboard.
//
//   authed + role doesn't cover    → direct-nav to matching dashboard
//                                    ANYWAY. The dashboard handles "you
//                                    don't have a merchant row yet" with
//                                    a register CTA.
//
//   authed + /me still loading     → short pending state; a fast second
//                                    click waits for data.
export function CtaLink({
  dashboard,
  children,
  variant = "primary",
  arrow = "→",
  className = "",
}: Props) {
  const router = useRouter();
  const { status } = useSession();
  const { data: me, isFetched: meFetched } = useUser();
  const role = me?.user.role as Role | undefined;
  const [pending, setPending] = useState(false);

  const handleClick = () => {
    if (pending) return;
    if (status === "loading") return;

    if (status !== "authenticated") {
      setPending(true);
      setTimeout(() => setPending(false), 3000);
      void signIn("google", { callbackUrl: "/onboarding" });
      return;
    }

    if (!meFetched) {
      // Authed but user row still resolving — avoid firing a routing
      // decision with `role === undefined`. Short pending state; user can
      // click again once data lands.
      setPending(true);
      setTimeout(() => setPending(false), 1500);
      return;
    }

    // For role='both' users, persist which side they jumped to so the
    // AppShell role-switcher respects it across refreshes.
    if (role === "both") {
      localStorage.setItem(
        LAST_ROLE_KEY,
        dashboard === "merchant" ? "merchant" : "agent",
      );
    }

    router.push(
      dashboard === "merchant" ? "/merchants/dashboard" : "/dashboard",
    );
  };

  const label = pending ? "Opening…" : children;

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className={`inline-flex items-center gap-3 border-b border-emerald-400/40 py-1 font-mono text-[12px] uppercase tracking-[0.22em] text-zinc-300 transition hover:border-emerald-400 hover:text-emerald-400 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0b0d] ${className}`}
      >
        <span>{label}</span>
        <span aria-hidden>{arrow}</span>
      </button>
    );
  }

  const base =
    "group inline-flex items-center justify-between gap-3 px-6 py-4 text-sm transition disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]";
  const primary =
    "border border-emerald-400 bg-emerald-400 font-semibold text-black hover:bg-emerald-300";
  const secondary =
    "border border-zinc-700 bg-transparent font-medium text-zinc-300 hover:border-zinc-500 hover:text-zinc-100";
  const classes = `${base} ${variant === "primary" ? primary : secondary} ${className}`;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={classes}
    >
      <span>{label}</span>
      <span
        aria-hidden
        className={`transition-transform group-hover:translate-x-1 ${
          variant === "primary" ? "" : "text-zinc-500"
        }`}
      >
        {arrow}
      </span>
    </button>
  );
}
