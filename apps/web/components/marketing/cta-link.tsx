"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn } from "next-auth/react";
import { useUser } from "@/hooks/use-user";
import { LAST_ROLE_KEY, type Role } from "@/lib/onboarding";

type Props = {
  dashboard: "agent" | "merchant";
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "inline";
  arrow?: "→" | "↗";
  className?: string;
};

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
      // Avoid routing with role=undefined; user can click again once data lands.
      setPending(true);
      setTimeout(() => setPending(false), 1500);
      return;
    }

    // role='both' users: persist target side so AppShell switcher honors it.
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

  const label = pending ? "opening…" : children;

  // Swiss-grid: every variant is the same underlined-mono CTA.
  // `secondary` is muted (foreground → grey); `primary`/`inline` are foreground.
  const tone =
    variant === "secondary"
      ? "border-[#888] text-[#888] hover:border-[#f5f5f5] hover:text-[#f5f5f5]"
      : "border-[#f5f5f5] text-[#f5f5f5] hover:border-[#e63946] hover:text-[#e63946]";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={`inline-flex items-center gap-2 border-b pb-1 font-mono text-[11px] uppercase tracking-[0.18em] transition disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:text-[#e63946] focus-visible:border-[#e63946] ${tone} ${className}`}
    >
      <span>{label}</span>
      <span aria-hidden>{arrow}</span>
    </button>
  );
}
