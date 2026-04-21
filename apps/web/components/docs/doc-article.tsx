import Link from "next/link";

// Flat navigation order across the full docs tree. Drives both the
// breadcrumb (group label + page title) and the prev/next footer at the
// bottom of every page. When adding a new page, just insert it here in
// the right spot — the footer wires up automatically.
export type DocPage = {
  slug: string; // e.g. "/docs/agents/install"
  group: string; // e.g. "Agents" — shown in breadcrumb
  title: string; // page title, shown in breadcrumb + footer
};

export const DOC_PAGES: DocPage[] = [
  { slug: "/docs", group: "Getting started", title: "Overview" },

  { slug: "/docs/agents/install", group: "Agents", title: "Install" },
  { slug: "/docs/agents/quickstart", group: "Agents", title: "Quickstart" },
  { slug: "/docs/agents/flow", group: "Agents", title: "How it works" },
  { slug: "/docs/agents/errors", group: "Agents", title: "Error handling" },
  { slug: "/docs/agents/advanced", group: "Agents", title: "Advanced usage" },
  { slug: "/docs/agents/reference", group: "Agents", title: "API reference" },

  { slug: "/docs/merchants/install", group: "Merchants", title: "Install" },
  { slug: "/docs/merchants/quickstart", group: "Merchants", title: "Quickstart" },
  { slug: "/docs/merchants/flow", group: "Merchants", title: "How it works" },
  { slug: "/docs/merchants/receipts", group: "Merchants", title: "Settlement receipts" },
  { slug: "/docs/merchants/pricing", group: "Merchants", title: "Pricing & assets" },
  { slug: "/docs/merchants/deploy", group: "Merchants", title: "Deploy" },
  { slug: "/docs/merchants/errors", group: "Merchants", title: "Error handling" },
  { slug: "/docs/merchants/reference", group: "Merchants", title: "API reference" },

  { slug: "/docs/concepts/x402", group: "Concepts", title: "x402 protocol" },
  { slug: "/docs/concepts/spend-caps", group: "Concepts", title: "Spend caps" },
  { slug: "/docs/concepts/networks", group: "Concepts", title: "Devnet vs mainnet" },
];

// Wrap every MDX page with this. Renders:
//   - mono breadcrumb above the title ("Agents / Install")
//   - the MDX children (your actual content)
//   - Prev/Next footer drawn from DOC_PAGES
export function DocArticle({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const idx = DOC_PAGES.findIndex((p) => p.slug === slug);
  const page = idx === -1 ? null : DOC_PAGES[idx];
  const prev = idx > 0 ? DOC_PAGES[idx - 1] : null;
  const next = idx >= 0 && idx < DOC_PAGES.length - 1 ? DOC_PAGES[idx + 1] : null;

  return (
    <article className="mx-auto max-w-[820px]">
      {page && page.slug !== "/docs" ? (
        <div className="mb-5 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.24em] text-zinc-500">
          <Link
            href="/docs"
            className="transition hover:text-zinc-300"
          >
            Docs
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-400">{page.group}</span>
        </div>
      ) : null}

      {children}

      {(prev || next) && (
        <nav
          aria-label="Page navigation"
          className="mt-20 grid gap-4 border-t border-zinc-800 pt-8 sm:grid-cols-2"
        >
          {prev ? (
            <DocPageLink direction="prev" page={prev} />
          ) : (
            <span aria-hidden />
          )}
          {next ? (
            <DocPageLink direction="next" page={next} />
          ) : (
            <span aria-hidden />
          )}
        </nav>
      )}
    </article>
  );
}

function DocPageLink({
  direction,
  page,
}: {
  direction: "prev" | "next";
  page: DocPage;
}) {
  const alignSelfEnd = direction === "next" ? "sm:justify-self-end sm:text-right" : "";
  return (
    <Link
      href={page.slug}
      className={`group block rounded border border-zinc-800 bg-[#0c0c0e] px-5 py-4 transition hover:border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] ${alignSelfEnd}`}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
        {direction === "prev" ? "← Previous" : "Next →"}
      </div>
      <div className="mt-1 text-[14px] text-zinc-100 transition group-hover:text-emerald-400">
        {page.title}
      </div>
    </Link>
  );
}
