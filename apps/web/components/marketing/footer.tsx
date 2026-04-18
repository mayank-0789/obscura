import Link from "next/link";
import { Logo } from "./logo";

export function Footer() {
  return (
    <footer className="border-t border-zinc-800/60 py-14">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="flex items-center gap-3">
              <Logo />
              <div>
                <div className="text-sm font-semibold tracking-tight">
                  Payrail
                </div>
                <div className="text-xs text-zinc-500">
                  The payment rail for AI agents.
                </div>
              </div>
            </div>
            <p className="mt-5 max-w-xs text-xs leading-5 text-zinc-500">
              Built for the Colosseum Frontier Hackathon 2026. Solana × Dodo
              Payments.
            </p>
          </div>

          <FooterGroup
            title="Product"
            links={[
              { label: "For agent devs", href: "/" },
              { label: "For merchants", href: "/merchants" },
              { label: "Pricing", href: "/#pricing" },
              { label: "Dashboard", href: "/dashboard" },
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

        <div className="mt-12 border-t border-zinc-900 pt-6 text-xs text-zinc-600">
          © 2026 Payrail. Shipped from India.
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
      <div className="mb-4 font-mono text-[10px] uppercase tracking-widest text-zinc-400">
        {title}
      </div>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="text-sm text-zinc-500 transition hover:text-zinc-100"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
