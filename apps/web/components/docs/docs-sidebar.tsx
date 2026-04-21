"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type DocLink = {
  label: string;
  href: string;
  soon?: boolean;
};

type DocSection = {
  title: string;
  links: DocLink[];
};

// Sidebar table of contents. Grouped by role/topic. When a page isn't built
// yet, mark `soon: true` so the label is visible but non-clickable — avoids
// broken links while the docs are still filling in.
const SECTIONS: DocSection[] = [
  {
    title: "Getting started",
    links: [
      { label: "Overview", href: "/docs" },
      { label: "For agent developers", href: "/docs/agents/quickstart" },
      { label: "For API providers", href: "/docs/merchants/quickstart" },
    ],
  },
  {
    title: "Agents",
    links: [
      { label: "Install", href: "/docs/agents/install" },
      { label: "Quickstart", href: "/docs/agents/quickstart" },
      { label: "How it works", href: "/docs/agents/flow" },
      { label: "Error handling", href: "/docs/agents/errors" },
      { label: "Advanced usage", href: "/docs/agents/advanced" },
      { label: "API reference", href: "/docs/agents/reference" },
    ],
  },
  {
    title: "Merchants",
    links: [
      { label: "Install", href: "/docs/merchants/install" },
      { label: "Quickstart", href: "/docs/merchants/quickstart" },
      { label: "How it works", href: "/docs/merchants/flow" },
      { label: "Settlement receipts", href: "/docs/merchants/receipts" },
      { label: "Pricing & assets", href: "/docs/merchants/pricing" },
      { label: "Deploy", href: "/docs/merchants/deploy" },
      { label: "Error handling", href: "/docs/merchants/errors" },
      { label: "API reference", href: "/docs/merchants/reference" },
    ],
  },
  {
    title: "Concepts",
    links: [
      { label: "x402 protocol", href: "/docs/concepts/x402" },
      { label: "Spend caps", href: "/docs/concepts/spend-caps" },
      { label: "Devnet vs mainnet", href: "/docs/concepts/networks" },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();
  return (
    <aside className="sticky top-16 hidden w-[240px] shrink-0 self-start py-10 pr-6 lg:block">
      <nav className="space-y-8">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.24em] text-zinc-500">
              {section.title}
            </div>
            <ul className="space-y-1.5">
              {section.links.map((link) => {
                const isActive = pathname === link.href;
                const isSoon = link.soon === true;
                return (
                  <li key={link.href}>
                    {isSoon ? (
                      <span className="flex items-center gap-2 py-1 text-[13px] text-zinc-600">
                        <span>{link.label}</span>
                        <span className="rounded border border-zinc-800 px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-zinc-600">
                          soon
                        </span>
                      </span>
                    ) : (
                      <Link
                        href={link.href}
                        className={`relative block py-1 text-[13px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] rounded ${
                          isActive
                            ? "text-emerald-400"
                            : "text-zinc-400 hover:text-zinc-100"
                        }`}
                      >
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute -left-4 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r bg-emerald-400"
                          />
                        )}
                        {link.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
