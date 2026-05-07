import Link from "next/link";
import type { CSSProperties } from "react";
import { Sparkline } from "@/components/ui/sparkline";
import { SectionMarker } from "@/components/ui/section-marker";
import { CtaLink } from "@/components/marketing/cta-link";
import { SignInButton } from "@/components/auth/sign-in-button";

export default function HomePage() {
  return (
    <div
      className="min-h-screen bg-[#0a0a0a] font-sans text-[#f5f5f5] antialiased"
      style={{ fontFeatureSettings: '"ss01", "cv11", "tnum"' } as CSSProperties}
    >
      <TopBar />
      <Hero />
      <Numbers />
      <TwoSDKs />
      <Stack />
      <FAQSection />
      <CTA />
      <FooterRule />
    </div>
  );
}


function TopBar() {
  return (
    <header className="border-b border-[#1f1f1f]">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5 lg:px-10">
        <div className="flex min-w-0 items-baseline gap-3">
          <Link
            href="/"
            className="text-[15px] font-medium tracking-[-0.01em]"
          >
            obscura
          </Link>
          <span className="hidden font-mono text-[10px] text-[#5a5a5a] sm:inline">───</span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[#888] sm:inline">
            confidential x402
          </span>
        </div>
        <nav className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.16em] sm:gap-7">
          <Link href="/docs" className="text-[#888] hover:text-[#f5f5f5]">
            docs
          </Link>
          <Link href="/demo" className="text-[#888] hover:text-[#f5f5f5]">
            demo
          </Link>
          <SignInButton />
        </nav>
      </div>
    </header>
  );
}


const LEAK_SERIES = [
  3, 4, 4, 6, 7, 9, 10, 13, 16, 18, 22, 27, 33, 38, 42, 48, 55, 63, 71, 80,
  89, 100,
];

function Hero() {
  return (
    <section className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
      <div className="grid grid-cols-12 gap-6 pt-14 pb-12 sm:pt-20 md:pt-24 md:pb-16 lg:pt-32 lg:pb-24">
        <div className="col-span-12 md:col-span-7">
          <SectionMarker index="00" label="Frontier 2026 · Umbra Privacy track" />
          <h1
            className="mt-8 text-balance md:mt-12"
            style={{
              fontSize: "clamp(36px, 9vw, 96px)",
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 0.96,
            }}
          >
            Confidential
            <br />
            pay-per-call
            <br />
            <span style={{ color: "#888", fontWeight: 300 }}>
              for AI agents.
            </span>
          </h1>
          <p className="mt-8 max-w-[58ch] text-[15px] leading-[1.6] text-[#888] sm:text-[16px] md:mt-10">
            x402 with the public spend graph removed. Agents pay merchants per
            API call from encrypted balances; the on-chain link between sender
            and receiver is broken via the Umbra mixer commitment tree.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4 font-mono text-[11px] uppercase tracking-[0.18em] sm:gap-x-8 md:mt-12">
            <CtaLink dashboard="agent">start agent</CtaLink>
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 border-b border-[#e63946] pb-1 text-[#e63946]"
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "#e63946" }}
              />
              live demo on devnet
            </Link>
            <span className="hidden text-[#888] sm:inline">npm i @obscura-app/sdk</span>
          </div>
        </div>

        <aside className="col-span-12 md:col-span-5 md:pt-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
            Fig. 1 · Vanilla x402 spend graph leakage
          </p>
          <p className="mt-1 text-[12px] text-[#888]">
            Public SPL transfers per agent, simulated 7-day window
          </p>
          <div
            className="mt-5"
            style={{
              borderTop: "1px solid #f5f5f5",
              borderBottom: "1px solid #1f1f1f",
              padding: "20px 0",
            }}
          >
            <Sparkline
              values={LEAK_SERIES}
              width={480}
              height={110}
              accent
              area
              endDot
              className="!block !h-[110px] !w-full"
            />
          </div>
          <div className="mt-4 grid grid-cols-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[#888]">
            <span>t-7d</span>
            <span className="text-center">today</span>
            <span className="text-right">pred. t+1</span>
          </div>
          <p className="mt-8 max-w-[36ch] text-[12.5px] leading-[1.6] text-[#888]">
            <span className="text-[#f5f5f5]">
              Obscura collapses this curve to a flat line
            </span>{" "}
            from any third-party observer. See §1.1 below.
          </p>
        </aside>
      </div>

      {/* TOC strip */}
      <div
        className="grid grid-cols-12 gap-x-4 gap-y-3 py-6 font-mono text-[10px] uppercase tracking-[0.16em] text-[#888] sm:gap-6 sm:py-7 sm:text-[11px] sm:tracking-[0.18em]"
        style={{
          borderTop: "1px solid #f5f5f5",
          borderBottom: "1px solid #1f1f1f",
        }}
      >
        {[
          ["01", "the leak"],
          ["02", "the fix"],
          ["03", "two sdks"],
          ["04", "stack"],
          ["05", "faq"],
          ["06", "ship"],
        ].map(([n, l]) => (
          <div key={n} className="col-span-6 sm:col-span-4 md:col-span-2">
            <span className="text-[#f5f5f5]">{n}</span> &nbsp;{l}
          </div>
        ))}
      </div>
    </section>
  );
}


const FIGURES = [
  {
    value: "$1.7T",
    label: "Agentic commerce volume projected for 2030",
    source: "McKinsey · Accenture",
    spark: [4, 5, 6, 8, 11, 14, 17, 22, 28, 35, 44, 55],
  },
  {
    value: "35M+",
    label: "x402 transactions already settled on Solana",
    source: "since Summer 2025",
    spark: [1, 2, 2, 3, 5, 7, 11, 14, 19, 24, 30, 35],
  },
  {
    value: "46%",
    label: "of YC Spring 2025 were AI agent companies",
    source: "Y Combinator",
    spark: [12, 18, 22, 28, 30, 33, 36, 38, 41, 43, 45, 46],
  },
  {
    value: "₹500",
    label: "minimum top-up to ship your first agent",
    source: "Obscura",
    spark: [500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500],
  },
];

function Numbers() {
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-20 md:py-24 lg:px-10 lg:py-28">
      <SectionMarker index="01" label="The market, now" />
      <h2
        className="mt-8 max-w-[28ch] md:mt-10"
        style={{
          fontSize: "clamp(28px, 5vw, 48px)",
          fontWeight: 500,
          letterSpacing: "-0.025em",
          lineHeight: 1.05,
        }}
      >
        Agent commerce isn&apos;t theoretical.
      </h2>
      <p className="mt-4 max-w-[56ch] text-[14px] leading-[1.6] text-[#888] sm:text-[15px] md:mt-5">
        It&apos;s already happening. Obscura is the rail between rupee top-ups
        and the agents that transact on Solana — confidentially.
      </p>

      <div
        className="mt-10 grid grid-cols-1 sm:grid-cols-2 md:mt-14 lg:grid-cols-4"
        style={{ borderTop: "1px solid #f5f5f5" }}
      >
        {FIGURES.map((f, i) => {
          const isLastInRow = (i + 1) % 4 === 0;
          return (
          <div
            key={i}
            className="px-5 py-7"
            style={{
              borderBottom: "1px solid #1f1f1f",
              borderRight: !isLastInRow && i < FIGURES.length - 1 ? "1px solid #1f1f1f" : undefined,
            }}
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
              fig. 1.{i + 1}
            </div>
            <div
              className="mt-3 tabular-nums"
              style={{
                fontSize: "clamp(32px, 5vw, 44px)",
                fontWeight: 500,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {f.value}
            </div>
            <div className="mt-4">
              <Sparkline values={f.spark} width={120} height={28} />
            </div>
            <p className="mt-4 text-[12.5px] leading-[1.55]">{f.label}</p>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#888]">
              {f.source}
            </p>
          </div>
          );
        })}
      </div>
    </section>
  );
}


function TwoSDKs() {
  return (
    <section
      className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-20 md:py-24 lg:px-10 lg:py-28"
      style={{ borderTop: "1px solid #1f1f1f" }}
    >
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4">
          <SectionMarker index="02" label="Two sides of the rail" />
          <h2
            className="mt-8 md:mt-10"
            style={{
              fontSize: "clamp(28px, 5vw, 48px)",
              fontWeight: 500,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
            }}
          >
            Two SDKs. <br />
            <span className="text-[#888]">One rail.</span>
          </h2>
        </div>
        <div className="col-span-12 grid grid-cols-1 gap-px md:col-span-8 md:grid-cols-2">
          <SDKColumn
            tag="for agents"
            title="@obscura-app/sdk"
            blurb="Wrap fetch. Get an encrypted spending account. The SDK handles the 402 dance."
            bullets={[
              "Per-agent monthly cap, enforced at sign time",
              "No wallet code, no signer, no retry logic",
              "Errors carry typed codes (over_cap, insufficient_funds…)",
            ]}
            cta="Start agent"
            ctaDashboard="agent"
            accent
          />
          <SDKColumn
            tag="for merchants"
            title="@obscura-app/merchant-sdk"
            blurb="One Express middleware. Issue 402, verify the umbra-mixer-v1 envelope on-chain, settle to your encrypted balance."
            bullets={[
              "No facilitator dependency",
              "Verifies queueSignature, payTo, mint, replay window",
              "Encrypted balance only you can decrypt",
            ]}
            cta="For API providers"
            ctaHref="/merchants"
          />
        </div>
      </div>
    </section>
  );
}

function SDKColumn({
  tag,
  title,
  blurb,
  bullets,
  cta,
  ctaHref,
  ctaDashboard,
  accent = false,
}: {
  tag: string;
  title: string;
  blurb: string;
  bullets: string[];
  cta: string;
  ctaHref?: string;
  ctaDashboard?: "agent" | "merchant";
  accent?: boolean;
}) {
  return (
    <article className="flex flex-col border border-[#1f1f1f] p-5 sm:p-7">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em]">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: accent ? "#e63946" : "#f5f5f5" }}
        />
        <span className="text-[#888]">{tag}</span>
      </div>
      <h3
        className="mt-5 font-mono"
        style={{
          fontSize: 18,
          fontWeight: 500,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h3>
      <p className="mt-3 text-[13.5px] leading-[1.6] text-[#888]">{blurb}</p>
      <ul className="mt-7 space-y-3 text-[13px] leading-[1.55]">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-3">
            <span
              className="mt-[10px] inline-block h-px w-3 shrink-0"
              style={{ backgroundColor: accent ? "#e63946" : "#f5f5f5" }}
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-10">
        {ctaDashboard ? (
          <CtaLink dashboard={ctaDashboard} variant={accent ? "primary" : "secondary"}>
            {cta}
          </CtaLink>
        ) : (
          <Link
            href={ctaHref ?? "#"}
            className="inline-flex items-center gap-2 border-b pb-1 font-mono text-[11px] uppercase tracking-[0.18em]"
            style={{
              borderColor: accent ? "#e63946" : "#f5f5f5",
              color: accent ? "#e63946" : "#f5f5f5",
            }}
          >
            {cta} <span aria-hidden>→</span>
          </Link>
        )}
      </div>
    </article>
  );
}


const STACK = [
  ["solana", "L1 settlement"],
  ["umbra", "encrypted balances + mixer"],
  ["arcium", "MPC compute"],
  ["helius", "RPC"],
  ["x402", "HTTP micropayments"],
  ["dodo", "fiat MoR (top-ups)"],
];

function Stack() {
  return (
    <section
      className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-20 md:py-24 lg:px-10"
      style={{ borderTop: "1px solid #1f1f1f" }}
    >
      <SectionMarker index="03" label="Built on" />
      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 md:mt-12 lg:grid-cols-3">
        {STACK.map(([name, role], i) => (
          <div
            key={name}
            className="px-2 py-5"
            style={{ borderTop: i < 3 ? "none" : "1px solid #1f1f1f" }}
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
              0{i + 1}
            </div>
            <div
              className="mt-3"
              style={{
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "-0.015em",
              }}
            >
              {name}
            </div>
            <div className="mt-1 text-[13px] text-[#888]">{role}</div>
          </div>
        ))}
      </div>
    </section>
  );
}


const FAQ_ITEMS = [
  {
    q: "Does my user need a crypto wallet?",
    a: "No. Every agent gets a server-derived Umbra encrypted token account, provisioned on sign-up. Users fund it with UPI or card. They never see a seed phrase.",
  },
  {
    q: "Who controls the money?",
    a: "The operator (custodial in v1). Each agent's Umbra keypair is HMAC-derived server-side from a master seed and never leaves the backend. Every outgoing transfer runs through a spend-cap check before signing.",
  },
  {
    q: "What happens at the monthly cap?",
    a: "The signer rejects further transactions with a clean 402 back to the agent and the operator gets a dashboard alert. Caps are enforced off-chain in v1; v2 migrates them into an Anchor program for trustless enforcement.",
  },
  {
    q: "What does it cost?",
    a: "Free during private beta. Production pricing is 2% platform fee on the fiat leg plus ~1% network + FX, surfaced upfront on the top-up screen. Merchants receive the full USDC amount minus Solana fees.",
  },
];

function FAQSection() {
  return (
    <section
      className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-20 md:py-24 lg:px-10 lg:py-28"
      style={{ borderTop: "1px solid #1f1f1f" }}
    >
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4">
          <SectionMarker index="04" label="FAQ" />
          <h2
            className="mt-8 md:mt-10"
            style={{
              fontSize: "clamp(26px, 5vw, 44px)",
              fontWeight: 500,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
            }}
          >
            Questions, fielded in order.
          </h2>
        </div>
        <div className="col-span-12 md:col-span-8">
          <div style={{ borderTop: "1px solid #f5f5f5" }}>
            {FAQ_ITEMS.map((item, i) => (
              <details
                key={i}
                className="group"
                style={{ borderBottom: "1px solid #1f1f1f" }}
              >
                <summary
                  className="flex cursor-pointer list-none items-baseline gap-3 px-1 py-5 sm:gap-5"
                  style={{ outline: "none" }}
                >
                  <span className="font-mono text-[11px] tabular-nums text-[#888]">
                    0{i + 1}
                  </span>
                  <span
                    className="flex-1 text-[14.5px] sm:text-[15.5px]"
                    style={{ fontWeight: 500 }}
                  >
                    {item.q}
                  </span>
                  <span className="font-mono text-[12px] text-[#888]">
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">−</span>
                  </span>
                </summary>
                <p className="pb-6 pl-7 pr-2 text-[13.5px] leading-[1.65] text-[#888] sm:pl-9 sm:pr-12 sm:text-[14px]">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}


function CTA() {
  return (
    <section
      className="mx-auto max-w-[1280px] px-4 py-20 sm:px-6 sm:py-24 md:py-28 lg:px-10 lg:py-36"
      style={{ borderTop: "1px solid #1f1f1f" }}
    >
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-7">
          <SectionMarker index="05" label="Ship" />
          <h2
            className="mt-8 text-balance md:mt-10"
            style={{
              fontSize: "clamp(32px, 8vw, 80px)",
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 0.98,
            }}
          >
            Ship your agent
            <br />
            <span style={{ color: "#888", fontWeight: 300 }}>
              this weekend.
            </span>
          </h2>
          <p className="mt-6 max-w-[42ch] text-[14px] leading-[1.6] text-[#888] sm:text-[15px] md:mt-8">
            Free during beta. Live in two minutes. The demo costs less than a
            chai.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4 font-mono text-[11px] uppercase tracking-[0.18em] sm:gap-x-8 md:mt-12">
            <CtaLink dashboard="agent">start agent</CtaLink>
            <Link
              href="/merchants"
              className="inline-flex items-center gap-2 border-b border-[#888] pb-1 text-[#888] hover:text-[#f5f5f5] hover:border-[#f5f5f5]"
            >
              for api providers <span aria-hidden>↗</span>
            </Link>
          </div>
        </div>
        <aside className="col-span-12 md:col-span-5 md:pt-2">
          <div className="overflow-x-auto border border-[#1f1f1f] p-5 font-mono text-[11.5px] leading-[1.7] text-[#f5f5f5] sm:p-6 sm:text-[12px]">
            <span className="text-[#888]">$</span> npm i @obscura-app/sdk
            <br />
            <span className="text-[#888]">$</span> export OBSCURA_KEY=sk_...
            <br />
            <br />
            <span style={{ color: "#e63946" }}>const</span> agent ={" "}
            <span style={{ color: "#e63946" }}>new</span> Obscura(&#123; apiKey &#125;);
            <br />
            <span style={{ color: "#e63946" }}>await</span> agent.fetch(url);
          </div>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
            Fig. 5.1 · the entire integration
          </p>
        </aside>
      </div>
    </section>
  );
}


function FooterRule() {
  return (
    <footer
      className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 sm:py-10 lg:px-10"
      style={{ borderTop: "1px solid #f5f5f5" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
        <span>obscurapp.com</span>
        <span className="order-last w-full text-center sm:order-none sm:w-auto">
          built with umbra · solana frontier 2026
        </span>
        <span>mit</span>
      </div>
    </footer>
  );
}
