"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Logo } from "@/components/marketing/logo";
import { useSignout } from "@/hooks/use-signout";
import { useUser } from "@/hooks/use-user";
import { useSetRole } from "@/hooks/use-set-role";
import { Kbd } from "./kbd";
import { RoleSwitcher } from "./role-switcher";
import { LAST_ROLE_KEY, type Role } from "@/lib/onboarding";

type Props = {
  // Crumb rendered after "Payrail /" on the left. Defaults to "Dashboard"
  // for backwards compat with the agent shell; merchant shell passes
  // "Merchant dashboard".
  crumb?: string;
  // Opening the command palette. Undefined → no palette trigger rendered
  // (the merchant shell doesn't use it today — agents list is irrelevant
  // there).
  onOpenPalette?: () => void;
};

export function DashboardTopBar({
  crumb = "Dashboard",
  onOpenPalette,
}: Props) {
  const router = useRouter();
  const { data: session } = useSession();
  const signOut = useSignout();
  const { data: me } = useUser();
  const setRole = useSetRole();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const identity = session?.user?.email ?? "";

  // Surface the "add the other side" affordance inside the authed product.
  // This is the replacement for the landing-page intent scheme: if a user
  // decides they want to register as a merchant (or as an agent), they do
  // it here rather than via a hidden-flag CTA on the marketing site.
  const role = me?.user.role as Role | undefined;
  const canRegisterMerchant = role === "user";
  const canRegisterAgent = role === "merchant";

  // `target` describes which dashboard the user is adding — it drives the
  // toast text, the LAST_ROLE_KEY write, and the post-upgrade redirect.
  // The mutation itself always sets role='both': either direction of
  // upgrade produces a dual-role user.
  //
  // Keep the menu OPEN during the async. Closing before settle means the
  // "Registering…" button label never paints and, on error, the user loses
  // context (they'd have to reopen the menu to retry). Close only on
  // success (navigation unmounts the menu) or keep open + toast on error.
  const upgradeRole = async (target: "agent" | "merchant") => {
    try {
      await setRole.mutateAsync("both");
      if (typeof window !== "undefined") {
        localStorage.setItem(LAST_ROLE_KEY, target);
      }
      setMenuOpen(false);
      router.push(
        target === "merchant" ? "/merchants/dashboard" : "/dashboard",
      );
      toast.success(
        target === "merchant"
          ? "Merchant side registered"
          : "Agent side ready — create your first agent",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast.error("Couldn't register the other side", { description: msg });
    }
  };

  // Click-outside close for the user menu
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  return (
    // 3-column grid keeps the user menu flush-right regardless of whether
    // the center slot has content. Flex + justify-between would leave the
    // left and right clusters floating against the window edges when the
    // center is empty (merchant shell without palette + single-role user).
    <header className="sticky top-0 z-40 grid h-12 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-zinc-800/80 bg-[#0a0a0a]/85 px-4 backdrop-blur-md">
      {/* Left: logo + workspace chip */}
      <div className="flex items-center gap-3 justify-self-start">
        <Link href="/" className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="text-[13px] font-semibold tracking-tight text-zinc-100">
            Payrail
          </span>
        </Link>
        <span className="text-zinc-700">/</span>
        <span className="text-[13px] text-zinc-400">{crumb}</span>
      </div>

      {/* Center: role switcher (for both-role users) + palette (agent shell).
          Either may render null — the grid column is `auto` so it collapses
          gracefully without pulling other columns. */}
      <div className="flex items-center gap-3 justify-self-center">
        <RoleSwitcher />
        {onOpenPalette ? (
          <button
            type="button"
            onClick={onOpenPalette}
            className="group hidden items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-[12px] text-zinc-500 transition hover:border-zinc-700 hover:text-zinc-300 md:inline-flex"
          >
            <svg
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="7"
                cy="7"
                r="4.5"
                stroke="currentColor"
                strokeWidth="1.3"
              />
              <path
                d="m11 11 3 3"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            <span>Search or jump</span>
            <span className="ml-2 flex items-center gap-1">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
        ) : null}
      </div>

      {/* Right: user menu */}
      <div className="relative justify-self-end" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="group flex items-center gap-2 rounded-md border border-transparent px-2 py-1 text-[13px] text-zinc-300 transition hover:border-zinc-800 hover:bg-zinc-950"
        >
          <span className="grid h-6 w-6 place-items-center rounded-full border border-zinc-700 bg-zinc-900 font-mono text-[10px] uppercase text-zinc-300">
            {identity?.[0] ?? "·"}
          </span>
          <span className="hidden max-w-[160px] truncate md:inline">
            {identity}
          </span>
          <svg
            viewBox="0 0 12 12"
            className="h-3 w-3 text-zinc-500 transition group-hover:text-zinc-300"
            aria-hidden="true"
          >
            <path
              d="M3 4.5 L6 7.5 L9 4.5"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 w-56 overflow-hidden rounded-md border border-zinc-800 bg-[#0c0c0e] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]"
          >
            <div className="border-b border-zinc-800 px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                Signed in
              </div>
              <div className="mt-1 truncate text-[13px] text-zinc-200">
                {identity}
              </div>
            </div>
            <Link
              href="/"
              role="menuitem"
              className="block px-3 py-2 text-[13px] text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
            >
              Marketing site
            </Link>
            <Link
              href="/docs"
              role="menuitem"
              className="block px-3 py-2 text-[13px] text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
            >
              Docs
            </Link>
            {canRegisterMerchant ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => upgradeRole("merchant")}
                disabled={setRole.isPending}
                className="block w-full border-t border-zinc-800 px-3 py-2 text-left text-[13px] text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-50"
              >
                {setRole.isPending
                  ? "Registering…"
                  : "Register as merchant →"}
              </button>
            ) : null}
            {canRegisterAgent ? (
              <button
                type="button"
                role="menuitem"
                onClick={() => upgradeRole("agent")}
                disabled={setRole.isPending}
                className="block w-full border-t border-zinc-800 px-3 py-2 text-left text-[13px] text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100 disabled:opacity-50"
              >
                {setRole.isPending
                  ? "Registering…"
                  : "Register as agent dev →"}
              </button>
            ) : null}
            <button
              type="button"
              role="menuitem"
              onClick={signOut}
              className="block w-full border-t border-zinc-800 px-3 py-2 text-left text-[13px] text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
