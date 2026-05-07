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
      { label: "The Umbra mixer", href: "/docs/concepts/mixer" },
      { label: "Spend caps", href: "/docs/concepts/spend-caps" },
      { label: "Devnet vs mainnet", href: "/docs/concepts/networks" },
    ],
  },
];

export function DocsSidebar() {
  const pathname = usePathname();
  const sectionsList = (
    <nav className="space-y-7 lg:space-y-9">
      {SECTIONS.map((section, i) => (
        <div key={section.title}>
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em]">
            <span style={{ color: "#e63946" }}>0{i + 1}</span>
            <span
              aria-hidden
              className="inline-block h-px w-6"
              style={{ backgroundColor: "#f5f5f5" }}
            />
            <span style={{ color: "#888" }}>{section.title}</span>
          </div>
          <ul className="mt-4 space-y-px">
            {section.links.map((link) => {
              const isActive = pathname === link.href;
              const isSoon = link.soon === true;
              return (
                <li key={link.href}>
                  {isSoon ? (
                    <span className="flex items-center gap-2 py-1.5 text-[13px] text-[#5a5a5a]">
                      <span>{link.label}</span>
                      <span
                        className="border px-1.5 py-px font-mono text-[10px] uppercase tracking-widest"
                        style={{
                          borderColor: "#1f1f1f",
                          color: "#5a5a5a",
                        }}
                      >
                        soon
                      </span>
                    </span>
                  ) : (
                    <Link
                      href={link.href}
                      className={`relative block py-1.5 pl-3 text-[13px] transition focus-visible:outline-none ${
                        isActive
                          ? "text-[#f5f5f5]"
                          : "text-[#888] hover:text-[#f5f5f5]"
                      }`}
                    >
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-0 h-full w-px"
                          style={{ backgroundColor: "#e63946" }}
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
  );

  return (
    <>
      <aside className="sticky top-0 hidden w-[240px] shrink-0 self-start py-10 pr-6 lg:block">
        {sectionsList}
      </aside>
      <details className="block w-full self-start border-b border-[#1f1f1f] py-3 lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-[#888]">
          <span>docs nav</span>
          <span className="font-mono text-[12px] text-[#5a5a5a]">▾</span>
        </summary>
        <div className="mt-5 pb-2">{sectionsList}</div>
      </details>
    </>
  );
}
