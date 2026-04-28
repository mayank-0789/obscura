"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  /** When true, render as disabled "soon" item — used for pages not yet built. */
  soon?: boolean;
  /** When true, allow as the active item for deeper paths (e.g. /merchants/apis/[id]). */
  matchDeeper?: boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

// Sidebar entries. Cash-out is on the v2 roadmap.
const GROUPS: NavGroup[] = [
  {
    title: "Workspace",
    items: [
      { label: "Dashboard", href: "/merchants/dashboard", matchDeeper: true },
      { label: "Payments", href: "/merchants/payments" },
      { label: "APIs", href: "/merchants/apis" },
      { label: "Cash-out", href: "/merchants/cashout", soon: true },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Settings", href: "/merchants/settings" },
      { label: "Docs", href: "/docs/merchants/quickstart" },
    ],
  },
];

export function MerchantSidebar({ merchantEtaAddress }: { merchantEtaAddress: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-[240px] shrink-0 flex-col border-r border-zinc-800/80 bg-[#08080a]">
      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {GROUPS.map((group) => (
          <div key={group.title} className="mb-7 last:mb-0">
            <div className="mb-2 px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              {group.title}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <SidebarLink item={item} pathname={pathname} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Payout wallet — mirror the agents-sidebar footer card. The full
          reveal UX (copy, QR, etc.) lives on the dashboard hero card; this
          is a persistent glance. */}
      <div className="border-t border-zinc-800/80 px-4 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          Payout wallet
        </div>
        {merchantEtaAddress ? (
          <>
            <div
              className="mt-1.5 truncate font-mono text-[12px] text-zinc-300"
              title={merchantEtaAddress}
            >
              {shortPk(merchantEtaAddress)}
            </div>
            <a
              href={`https://solscan.io/account/${merchantEtaAddress}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-zinc-500 transition hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08080a] rounded"
            >
              View on Solscan
              <span aria-hidden className="text-zinc-600">
                ↗
              </span>
            </a>
          </>
        ) : (
          // Neutral zinc for in-progress — amber is reserved for caution
          // states elsewhere in the app, so provisioning text in amber
          // reads as an error rather than a loading indicator.
          <div className="mt-1.5 flex items-center gap-2 text-[12px] text-zinc-500">
            <span
              aria-hidden
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-600"
            />
            Provisioning…
          </div>
        )}
      </div>
    </aside>
  );
}

function SidebarLink({
  item,
  pathname,
}: {
  item: NavItem;
  pathname: string;
}) {
  const isActive = item.matchDeeper
    ? pathname === item.href || pathname.startsWith(item.href + "/")
    : pathname === item.href;

  if (item.soon) {
    // Use a disabled button (not a span) so screen readers announce the
    // disabled state and the tab order correctly skips it, while still
    // letting sighted users see what's coming.
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Coming soon"
        className="flex w-full cursor-not-allowed items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] text-zinc-600"
      >
        <span>{item.label}</span>
        <span className="rounded border border-zinc-800 px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-zinc-600">
          soon
        </span>
      </button>
    );
  }

  return (
    <Link
      href={item.href}
      className={`relative block rounded-md px-2 py-1.5 text-[13px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#08080a] ${
        isActive
          ? "bg-zinc-900 text-zinc-50"
          : "text-zinc-300 hover:bg-zinc-900/60 hover:text-zinc-100"
      }`}
    >
      {isActive && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-emerald-400"
        />
      )}
      {item.label}
    </Link>
  );
}

function shortPk(pk: string) {
  if (pk.length <= 12) return pk;
  return `${pk.slice(0, 6)}…${pk.slice(-4)}`;
}
