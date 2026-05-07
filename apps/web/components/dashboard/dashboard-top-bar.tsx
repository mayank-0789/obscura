"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useSignout } from "@/hooks/use-signout";
import { useUser } from "@/hooks/use-user";
import { useSetRole } from "@/hooks/use-set-role";
import { Kbd } from "./kbd";
import { RoleSwitcher } from "./role-switcher";
import { LAST_ROLE_KEY, type Role } from "@/lib/onboarding";

type Props = {
  crumb?: string;
  onOpenPalette?: () => void;
};

export function DashboardTopBar({
  crumb = "dashboard",
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

  const role = me?.user.role as Role | undefined;
  const canRegisterMerchant = role === "user";
  const canRegisterAgent = role === "merchant";

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
          ? "merchant side registered"
          : "agent side ready — create your first agent",
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "please try again.";
      toast.error("couldn't register the other side", { description: msg });
    }
  };

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
    <header className="sticky top-0 z-40 grid h-12 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-[#1f1f1f] bg-[#0a0a0a] px-5">
      {/* LEFT — wordmark + crumb */}
      <div className="flex items-baseline gap-3 justify-self-start">
        <Link
          href="/"
          className="text-[13px] font-medium tracking-[-0.01em] text-[#f5f5f5]"
        >
          obscura
        </Link>
        <span className="font-mono text-[10px] text-[#5a5a5a]">───</span>
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#888]">
          {crumb}
        </span>
      </div>

      {/* CENTER — role switcher + search */}
      <div className="flex items-center gap-5 justify-self-center">
        <RoleSwitcher />
        {onOpenPalette ? (
          <button
            type="button"
            onClick={onOpenPalette}
            className="group hidden items-center gap-3 border border-[#1f1f1f] bg-[#0a0a0a] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-[#888] transition hover:border-[#333] hover:text-[#f5f5f5] md:inline-flex"
          >
            <svg
              viewBox="0 0 16 16"
              className="h-3 w-3"
              fill="none"
              aria-hidden="true"
            >
              <circle
                cx="7"
                cy="7"
                r="4.5"
                stroke="currentColor"
                strokeWidth="1.2"
              />
              <path
                d="m11 11 3 3"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
            <span>search</span>
            <span className="ml-1 flex items-center gap-1">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
        ) : null}
      </div>

      {/* RIGHT — identity + menu */}
      <div className="relative justify-self-end" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="group flex items-center gap-2.5 px-2 py-1 text-[12px] text-[#f5f5f5] transition hover:bg-[#141414]"
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: "#e63946" }}
            aria-hidden="true"
          />
          <span className="hidden max-w-[180px] truncate font-mono text-[11px] tracking-[-0.01em] md:inline">
            {identity}
          </span>
          <svg
            viewBox="0 0 12 12"
            className="h-3 w-3 text-[#5a5a5a] transition group-hover:text-[#f5f5f5]"
            aria-hidden="true"
          >
            <path
              d="M3 4.5 L6 7.5 L9 4.5"
              stroke="currentColor"
              strokeWidth="1.3"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 w-60 border border-[#1f1f1f] bg-[#0a0a0a]"
          >
            <div className="border-b border-[#1f1f1f] px-4 py-3">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
                signed in
              </div>
              <div className="mt-1.5 truncate font-mono text-[12px] text-[#f5f5f5]">
                {identity}
              </div>
            </div>
            <MenuLink href="/">marketing site</MenuLink>
            <MenuLink href="/docs">docs</MenuLink>
            {canRegisterMerchant ? (
              <MenuButton
                onClick={() => upgradeRole("merchant")}
                disabled={setRole.isPending}
              >
                {setRole.isPending
                  ? "registering…"
                  : "register as merchant →"}
              </MenuButton>
            ) : null}
            {canRegisterAgent ? (
              <MenuButton
                onClick={() => upgradeRole("agent")}
                disabled={setRole.isPending}
              >
                {setRole.isPending
                  ? "registering…"
                  : "register as agent dev →"}
              </MenuButton>
            ) : null}
            <MenuButton onClick={signOut}>sign out</MenuButton>
          </div>
        )}
      </div>
    </header>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      role="menuitem"
      className="block border-t border-[#1f1f1f] px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.16em] text-[#888] transition hover:bg-[#141414] hover:text-[#f5f5f5]"
    >
      {children}
    </Link>
  );
}

function MenuButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className="block w-full border-t border-[#1f1f1f] px-4 py-2.5 text-left font-mono text-[11px] uppercase tracking-[0.16em] text-[#888] transition hover:bg-[#141414] hover:text-[#f5f5f5] disabled:opacity-50"
    >
      {children}
    </button>
  );
}
