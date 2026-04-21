"use client";

import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@/hooks/use-user";
import {
  LAST_ROLE_KEY,
  isDualRole,
  type ActiveRole,
  type Role,
} from "@/lib/onboarding";

// Segmented pill that flips a role='both' user between /dashboard and
// /merchants/dashboard. Renders null for single-role users — they can't
// switch.
//
// Active side is inferred from the URL (anything under /merchants is
// "merchant"; otherwise "agent"). Clicking the inactive side navigates AND
// persists the choice to localStorage so next login lands there.
export function RoleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me } = useUser();
  const role = (me?.user.role as Role | undefined) ?? "user";

  if (!isDualRole(role)) return null;

  // Trailing slash is load-bearing — `/merchants` is the marketing landing
  // and should NOT be classified as the merchant workspace. Only routes
  // *under* /merchants (the authenticated dashboard tree) flip the switcher.
  const active: ActiveRole = pathname.startsWith("/merchants/")
    ? "merchant"
    : "agent";

  const flip = (next: ActiveRole) => {
    if (next === active) return;
    if (typeof window !== "undefined") {
      localStorage.setItem(LAST_ROLE_KEY, next);
    }
    router.push(next === "merchant" ? "/merchants/dashboard" : "/dashboard");
  };

  return (
    <div
      role="group"
      aria-label="Switch workspace"
      className="inline-flex items-center rounded-md border border-zinc-800 bg-zinc-950 p-0.5"
    >
      <SwitchButton
        label="Agent"
        active={active === "agent"}
        onClick={() => flip("agent")}
      />
      <SwitchButton
        label="Merchant"
        active={active === "merchant"}
        onClick={() => flip("merchant")}
      />
    </div>
  );
}

function SwitchButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-[5px] px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.18em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] ${
        active
          ? "bg-emerald-500/10 text-emerald-300"
          : "text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}
