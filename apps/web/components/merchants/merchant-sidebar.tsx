"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  label: string;
  href: string;
  soon?: boolean;
  matchDeeper?: boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const GROUPS: NavGroup[] = [
  {
    title: "workspace",
    items: [
      { label: "dashboard", href: "/merchants/dashboard", matchDeeper: true },
      { label: "payments", href: "/merchants/payments" },
      { label: "apis", href: "/merchants/apis" },
      { label: "cash-out", href: "/merchants/cashout", soon: true },
    ],
  },
  {
    title: "account",
    items: [
      { label: "settings", href: "/merchants/settings" },
      { label: "docs", href: "/docs/merchants/quickstart" },
    ],
  },
];

export function MerchantSidebar({ merchantEtaAddress }: { merchantEtaAddress: string | null }) {
  const pathname = usePathname();

  return (
    <aside className="flex h-[calc(100vh-3rem)] w-[240px] max-w-[85vw] shrink-0 flex-col border-r border-[#1f1f1f] bg-[#0a0a0a] md:h-auto">
      <nav className="flex-1 overflow-y-auto py-5">
        {GROUPS.map((group, gi) => (
          <div key={group.title} className="mb-6 last:mb-0">
            <div className="mb-2 flex items-baseline gap-2.5 px-5 font-mono text-[10px] uppercase tracking-[0.22em]">
              <span style={{ color: "#e63946" }}>0{gi}</span>
              <span className="inline-block h-px w-4 bg-[#f5f5f5]" />
              <span className="text-[#888]">{group.title}</span>
            </div>
            <ul>
              {group.items.map((item) => (
                <li key={item.href}>
                  <SidebarLink item={item} pathname={pathname} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-[#1f1f1f] px-5 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#5a5a5a]">
          payout wallet
        </div>
        {merchantEtaAddress ? (
          <>
            <div
              className="mt-2 truncate font-mono text-[12px] text-[#f5f5f5]"
              title={merchantEtaAddress}
            >
              {shortPk(merchantEtaAddress)}
            </div>
            <a
              href={`https://solscan.io/account/${merchantEtaAddress}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#888] transition hover:text-[#e63946]"
            >
              solscan
              <span aria-hidden>↗</span>
            </a>
          </>
        ) : (
          <div className="mt-2 flex items-center gap-2 font-mono text-[11px] text-[#888]">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-[#5a5a5a]"
            />
            provisioning…
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
    return (
      <span
        aria-disabled="true"
        title="Coming soon"
        className="flex w-full cursor-not-allowed items-baseline justify-between gap-2 px-5 py-2 text-left"
      >
        <span className="flex items-baseline gap-2.5">
          <span aria-hidden className="font-mono text-[10px] text-[#5a5a5a]">
            ○
          </span>
          <span className="text-[12.5px] text-[#5a5a5a]">{item.label}</span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#5a5a5a]">
          soon
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={`group relative flex items-baseline gap-2.5 px-5 py-2 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e63946] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] ${
        isActive ? "bg-[#141414]" : "hover:bg-[#0e0e0e]"
      }`}
    >
      {isActive && (
        <span
          aria-hidden
          className="absolute left-0 top-0 h-full w-px"
          style={{ backgroundColor: "#e63946" }}
        />
      )}
      <span
        aria-hidden
        className="font-mono text-[10px]"
        style={{ color: isActive ? "#e63946" : "#5a5a5a" }}
      >
        {isActive ? "◉" : "○"}
      </span>
      <span
        className={`text-[12.5px] tracking-[-0.005em] ${
          isActive ? "text-[#f5f5f5]" : "text-[#aaa] group-hover:text-[#f5f5f5]"
        }`}
      >
        {item.label}
      </span>
    </Link>
  );
}

function shortPk(pk: string) {
  if (pk.length <= 12) return pk;
  return `${pk.slice(0, 6)}…${pk.slice(-4)}`;
}
