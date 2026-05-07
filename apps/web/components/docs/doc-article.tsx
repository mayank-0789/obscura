import Link from "next/link";
import { SectionMarker } from "@/components/ui/section-marker";

type DocLink = { label: string; href: string };
type DocSection = { title: string; links: DocLink[] };

// Mirror of DocsSidebar's SECTIONS — kept local so the article header can
// resolve slug → (section, label, prev, next) without importing a "use client" file.
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

const FLAT = SECTIONS.flatMap((s, sIdx) =>
  s.links.map((link, lIdx) => ({
    section: s.title,
    sectionIndex: sIdx,
    linkIndex: lIdx,
    ...link,
  })),
);

function lookup(slug: string) {
  const idx = FLAT.findIndex((e) => e.href === slug);
  if (idx === -1) {
    return { current: null, prev: null, next: null };
  }
  return {
    current: FLAT[idx]!,
    prev: idx > 0 ? FLAT[idx - 1]! : null,
    next: idx < FLAT.length - 1 ? FLAT[idx + 1]! : null,
  };
}

export function DocArticle({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const { current, prev, next } = lookup(slug);
  const sectionIndex = current
    ? String(current.sectionIndex + 1).padStart(2, "0")
    : "00";
  const sectionLabel = current?.section ?? "Docs";

  return (
    <article className="max-w-[760px]">
      <header className="mb-10">
        <SectionMarker index={sectionIndex} label={sectionLabel} />
        {current ? (
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-[#5a5a5a]">
            {slug}
          </p>
        ) : null}
      </header>

      <div>{children}</div>

      {(prev || next) && (
        <nav
          className="mt-20 grid grid-cols-1 gap-px sm:grid-cols-2"
          style={{ borderTop: "1px solid #1f1f1f" }}
          aria-label="Article navigation"
        >
          {prev ? (
            <Link
              href={prev.href}
              className="block px-1 py-5 transition hover:bg-[#0e0e0e]"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
                ← previous
              </span>
              <span className="mt-2 block text-[14px] text-[#f5f5f5]">
                {prev.label}
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link
              href={next.href}
              className="block px-1 py-5 text-right transition hover:bg-[#0e0e0e] sm:border-l sm:border-[#1f1f1f]"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
                next →
              </span>
              <span className="mt-2 block text-[14px] text-[#f5f5f5]">
                {next.label}
              </span>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </article>
  );
}
