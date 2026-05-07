"use client";

import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@/hooks/use-user";
import {
  LAST_ROLE_KEY,
  isDualRole,
  type ActiveRole,
  type Role,
} from "@/lib/onboarding";

/** Segmented pill flipping role='both' users between agent/merchant dashboards. */
export function RoleSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me } = useUser();
  const role = (me?.user.role as Role | undefined) ?? "user";

  if (!isDualRole(role)) return null;

  // Trailing slash is load-bearing: `/merchants` is marketing, not workspace.
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
      className="inline-flex items-center border border-[#1f1f1f] bg-[#0a0a0a]"
    >
      <SwitchButton
        label="agent"
        active={active === "agent"}
        onClick={() => flip("agent")}
      />
      <SwitchButton
        label="merchant"
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
      className={`px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e63946] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] ${
        active
          ? "bg-[#141414] text-[#e63946]"
          : "text-[#888] hover:text-[#f5f5f5]"
      }`}
    >
      {label}
    </button>
  );
}
