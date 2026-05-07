"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Logo } from "./logo";
import { SignInButton } from "../auth/sign-in-button";
import { useUser } from "@/hooks/use-user";
import {
  LAST_ROLE_KEY,
  type Role,
  type ActiveRole,
} from "@/lib/onboarding";

export function Nav({
  variant = "user",
}: {
  variant?: "user" | "merchant";
}) {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-[#0a0a0a]/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-10">
        <Link href="/" className="group flex min-w-0 items-center gap-3">
          <Logo />
          <div className="flex items-baseline gap-2.5">
            <span className="font-display text-[20px] font-normal leading-none tracking-[-0.01em] text-zinc-50 transition group-hover:text-emerald-300 sm:text-[22px]">
              Obscura
            </span>
            {variant === "merchant" && (
              <span className="hidden font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500 sm:inline">
                /merchants
              </span>
            )}
          </div>
        </Link>

        <nav className="flex items-center gap-4 text-[13px] text-zinc-400 sm:gap-6 md:gap-8">
          <Link
            href="/docs"
            className="relative transition hover:text-zinc-100"
          >
            Docs
          </Link>
          {variant === "user" ? (
            <Link
              href="/merchants"
              className="hidden transition hover:text-zinc-100 sm:inline"
            >
              For merchants
            </Link>
          ) : (
            <Link href="/" className="hidden transition hover:text-zinc-100 sm:inline">
              For agent devs
            </Link>
          )}
          <Link
            href="https://github.com/mayank-0789/obscura"
            className="hidden items-center gap-1.5 transition hover:text-zinc-100 md:inline-flex"
          >
            GitHub
            <span aria-hidden="true" className="text-[10px] text-zinc-600">
              ↗
            </span>
          </Link>
          <AuthedDashboardLink />
          <SignInButton />
        </nav>
      </div>
    </header>
  );
}

function AuthedDashboardLink() {
  const { status } = useSession();
  const { data: me } = useUser();

  if (status !== "authenticated") return null;
  // Wait for /me so href doesn't flash the wrong destination.
  if (!me) return null;

  const role = me.user.role as Role;
  const href = dashboardHrefForRole(role);

  return (
    <Link
      href={href}
      className="hidden items-center gap-1.5 transition hover:text-zinc-100 md:inline-flex"
    >
      Dashboard
    </Link>
  );
}

function dashboardHrefForRole(role: Role): string {
  if (role === "merchant") return "/merchants/dashboard";
  if (role === "both") {
    const last =
      typeof window !== "undefined"
        ? (localStorage.getItem(LAST_ROLE_KEY) as ActiveRole | null)
        : null;
    return last === "merchant" ? "/merchants/dashboard" : "/dashboard";
  }
  return "/dashboard";
}
