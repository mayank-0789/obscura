import Link from "next/link";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="border-t border-zinc-800/60 bg-[#0a0a0a]">
      <div className="mx-auto max-w-[1400px] px-6 py-16 lg:px-10">
        {/* Masthead row */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-zinc-800 pb-5 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
          <span className="flex items-center gap-2 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Payrail Journal
          </span>
          <span className="text-zinc-800">/</span>
          <span>Issue No. 001</span>
          <span className="text-zinc-800">/</span>
          <span>Volume I · April 2026</span>
          <span className="ml-auto hidden md:inline">
            Solana × Dodo × x402
          </span>
        </div>

        {/* Link grid */}
        <div className="mt-12 grid gap-12 md:grid-cols-5">
          <div className="md:col-span-2">
            <Link href="/" className="group inline-flex items-center gap-3">
              <Logo />
              <div>
                <div className="font-display text-[20px] font-normal leading-none tracking-[-0.01em] text-zinc-50 transition group-hover:text-emerald-300">
                  Payrail
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-600">
                  The payment rail for AI agents.
                </div>
              </div>
            </Link>
            <p className="mt-6 max-w-xs text-[13px] leading-[1.65] text-zinc-500">
              Fund in rupees. Settle in stablecoins. Built at Colosseum
              Frontier 2026, shipped from India.
            </p>
          </div>

          <FooterGroup
            title="Product"
            links={[
              { label: "For agent devs", href: "/" },
              { label: "For merchants", href: "/merchants" },
              { label: "Dashboard", href: "/dashboard" },
              { label: "Pricing", href: "/#pricing" },
            ]}
          />
          <FooterGroup
            title="Developers"
            links={[
              { label: "Docs", href: "/docs" },
              { label: "Agent SDK", href: "/docs/users/quickstart" },
              { label: "Merchant SDK", href: "/docs/merchants/quickstart" },
              { label: "FAQ", href: "/docs/faq" },
            ]}
          />
          <FooterGroup
            title="Company"
            links={[
              { label: "GitHub", href: "https://github.com" },
              { label: "X (Twitter)", href: "https://x.com" },
              { label: "Status", href: "/status" },
              { label: "License (MIT)", href: "/LICENSE" },
            ]}
          />
        </div>

        {/* Signoff */}
        <div className="mt-16 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-t border-zinc-900 pt-8">
          <div className="font-display text-[13px] italic text-zinc-500">
            — End of issue.
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-600">
            © 2026 Payrail · MIT · Shipped from Bangalore, IN
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-400">
        {title}
      </div>
      <ul className="space-y-2.5">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="text-[13px] text-zinc-500 transition hover:text-zinc-100"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
