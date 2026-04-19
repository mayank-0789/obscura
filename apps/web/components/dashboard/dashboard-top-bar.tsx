"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { Logo } from "@/components/marketing/logo";
import { useSignout } from "@/hooks/use-signout";
import { Kbd } from "./kbd";

type Props = {
  onOpenPalette: () => void;
};

export function DashboardTopBar({ onOpenPalette }: Props) {
  const { user } = usePrivy();
  const signOut = useSignout();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const identity =
    user?.email?.address ??
    user?.google?.email ??
    user?.phone?.number ??
    (user ? `${user.id.slice(0, 10)}…` : "");

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
    <header className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-zinc-800/80 bg-[#0a0a0a]/85 px-4 backdrop-blur-md">
      {/* Left: logo + workspace chip */}
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2">
          <Logo size="sm" />
          <span className="text-[13px] font-semibold tracking-tight text-zinc-100">
            Payrail
          </span>
        </Link>
        <span className="text-zinc-700">/</span>
        <span className="text-[13px] text-zinc-400">Dashboard</span>
      </div>

      {/* Center: command palette trigger */}
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
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.3" />
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

      {/* Right: user menu */}
      <div className="relative" ref={menuRef}>
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
