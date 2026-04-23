import Link from "next/link";
import { Nav } from "../components/marketing/nav";
import { Footer } from "../components/marketing/footer";
import { CtaLink } from "../components/marketing/cta-link";
import { FlowDiagram } from "../components/marketing/landing/flow-diagram";
import { CodeEditor } from "../components/marketing/landing/code-editor";
import { ReceiptCard } from "../components/marketing/landing/receipt-card";
import { Ticker } from "../components/marketing/landing/ticker";
import { FAQ, type QA } from "../components/marketing/landing/faq";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 antialiased">
      <Nav variant="user" />
      <Hero />
      <Ticker />
      <FlowDiagram />
      <Quickstart />
      <SplitAudience />
      <StackStrip />
      <Numbers />
      <FAQSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ========================================================================
   HERO — magazine masthead + oversized serif display + live receipt card
   ======================================================================== */

function Hero() {
  return (
    <section className="bg-noise relative overflow-hidden">
      {/* Engineering grid, masked off the edges so it reads as atmosphere. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_85%_65%_at_75%_0%,black_10%,transparent_75%)]"
      />
      {/* Ambient emerald wash — the accent color as atmosphere, not chrome. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full bg-emerald-500/10 blur-[140px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 top-80 h-[380px] w-[380px] rounded-full bg-emerald-500/5 blur-[120px]"
      />

      {/* ── Main hero grid ── */}
      <div className="relative mx-auto grid max-w-[1400px] grid-cols-12 gap-x-8 gap-y-16 px-6 pb-28 pt-24 lg:px-10 lg:pb-36 lg:pt-32">
        {/* LEFT — the headline */}
        <div className="col-span-12 md:col-span-8">
          <p className="rule-with-pip mb-10 font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-400">
            <span>The rail, explained</span>
          </p>

          <h1 className="font-display text-balance text-[56px] font-light leading-[0.94] tracking-[-0.03em] text-zinc-50 md:text-[96px] lg:text-[124px]">
            <span className="reveal block" style={{ animationDelay: "0.05s" }}>
              The payment
            </span>
            <span className="reveal block" style={{ animationDelay: "0.15s" }}>
              rail for{" "}
              <span className="italic text-emerald-gradient">AI agents.</span>
            </span>
          </h1>

          <p
            className="reveal mt-12 max-w-[58ch] text-[18px] leading-[1.65] text-zinc-300 md:text-[20px] md:leading-[1.6]"
            style={{ animationDelay: "0.35s" }}
          >
            Your agent gets a spending account. You fund it in rupees. It
            settles in stablecoins on Solana —{" "}
            <span className="text-zinc-100">one API call at a time.</span>
          </p>

          <div
            className="reveal mt-10 flex flex-col gap-3 sm:flex-row"
            style={{ animationDelay: "0.5s" }}
          >
            <CtaLink dashboard="agent" variant="primary" arrow="→">
              Start your first agent
            </CtaLink>
            <Link
              href="/merchants"
              className="group inline-flex items-center justify-between gap-3 border border-zinc-700 bg-transparent px-6 py-4 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
            >
              <span>For API providers</span>
              <span
                aria-hidden="true"
                className="text-zinc-500 transition-transform group-hover:translate-x-1"
              >
                ↗
              </span>
            </Link>
          </div>

          <div
            className="reveal mt-16 grid max-w-2xl grid-cols-3 gap-6 border-t border-zinc-800/80 pt-6"
            style={{ animationDelay: "0.65s" }}
          >
            <Stat label="Fiat → on-chain" value="< 30s" />
            <Stat label="Per-call median" value="412 ms" />
            <Stat label="Min. top-up" value="₹500" />
          </div>
        </div>

        {/* RIGHT — live receipt card + byline */}
        <aside
          className="reveal col-span-12 md:col-span-4"
          style={{ animationDelay: "0.25s" }}
        >
          <div className="md:sticky md:top-28">
            <ReceiptCard />
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">
              Synthetic example. Real ledger entries on devnet today.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-zinc-800 pt-5 font-mono text-[10px] uppercase tracking-[0.3em] text-zinc-500">
              <span className="flex items-center gap-2 text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Live
              </span>
              <span className="text-zinc-800">/</span>
              <span>Solana</span>
              <span className="text-zinc-800">×</span>
              <span>Dodo</span>
              <span className="text-zinc-800">×</span>
              <span>x402</span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-light text-zinc-100">
        {value}
      </div>
    </div>
  );
}

/* ========================================================================
   QUICKSTART — code editor
   ======================================================================== */

function Quickstart() {
  return (
    <section className="relative overflow-hidden border-b border-zinc-800/60 bg-[#0a0a0a] py-28 lg:py-36">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 top-1/3 h-[320px] w-[320px] rounded-full bg-emerald-500/6 blur-[120px]"
      />
      <div className="relative mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="grid grid-cols-12 gap-x-6 gap-y-12">
          <div className="col-span-12 md:col-span-5 lg:col-span-4">
            <p className="rule-with-pip font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-400">
              <span>Section III — The SDK</span>
            </p>
            <h2 className="mt-8 font-display text-[40px] font-light leading-[1.02] tracking-[-0.02em] text-zinc-50 md:text-[54px]">
              A spending account in{" "}
              <span className="italic text-emerald-gradient">three lines.</span>
            </h2>
            <p className="mt-6 text-[15px] leading-[1.7] text-zinc-400">
              Drop <code className="font-mono text-emerald-400">@payrail/sdk</code>{" "}
              into your agent. The wrapped{" "}
              <code className="font-mono text-zinc-300">fetch()</code> now has
              a budget, a signer, and a paper trail.
            </p>

            <ul className="mt-10 space-y-4 text-[14px] text-zinc-300">
              <BulletLine>
                <strong className="text-zinc-100">No wallet code.</strong> The
                SDK ships a remote signer that calls our backend on 402.
              </BulletLine>
              <BulletLine>
                <strong className="text-zinc-100">No retry logic.</strong>{" "}
                Payments settle, the request replays with{" "}
                <code className="font-mono text-zinc-400">X-Payment</code>.
              </BulletLine>
              <BulletLine>
                <strong className="text-zinc-100">No surprise spend.</strong>{" "}
                Per-agent monthly caps, enforced before every signature.
              </BulletLine>
            </ul>

            <div className="mt-10 flex flex-wrap gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              <Link
                href="/docs/agents/quickstart"
                className="inline-flex items-center gap-2 border-b border-zinc-700 pb-0.5 transition hover:border-emerald-400 hover:text-emerald-400"
              >
                Read the quickstart
                <span aria-hidden>→</span>
              </Link>
              <span className="text-zinc-700">/</span>
              <Link
                href="https://github.com/mayank-0789/payrail"
                className="inline-flex items-center gap-2 border-b border-zinc-700 pb-0.5 transition hover:border-emerald-400 hover:text-emerald-400"
              >
                View on GitHub
                <span aria-hidden>↗</span>
              </Link>
            </div>
          </div>

          <div className="col-span-12 md:col-span-7 lg:col-span-8">
            <CodeEditor />
          </div>
        </div>
      </div>
    </section>
  );
}

function BulletLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3 leading-[1.6]">
      <span
        aria-hidden="true"
        className="mt-[10px] inline-block h-px w-4 shrink-0 bg-emerald-400"
      />
      <span className="text-zinc-400">{children}</span>
    </li>
  );
}

/* ========================================================================
   SPLIT AUDIENCE — two sides of the rail
   ======================================================================== */

function SplitAudience() {
  return (
    <section className="relative overflow-hidden border-b border-zinc-800/60 bg-[#08080a] py-28 lg:py-36">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="mb-16 grid grid-cols-12 items-end gap-8">
          <div className="col-span-12 md:col-span-4">
            <p className="rule-with-pip font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-400">
              <span>Section IV — Audiences</span>
            </p>
          </div>
          <div className="col-span-12 md:col-span-8">
            <h2 className="font-display text-[40px] font-light leading-[1.02] tracking-[-0.02em] text-zinc-50 md:text-[60px]">
              Two sides of the rail.{" "}
              <span className="italic text-zinc-500">
                Pick yours.
              </span>
            </h2>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <AudienceCard
            tag="01 / Operators"
            title="Building agents"
            subtitle="Ship autonomous software that pays its own way."
            bullets={[
              "One SDK call replaces wallets, signers, and payment loops.",
              "Monthly spend caps per agent, enforced at signature time.",
              "UPI and card top-ups via Dodo — GST-compliant, MoR-backed.",
              "A dashboard that shows every rupee in and every 0.008 USDC out.",
            ]}
            cta={{
              kind: "dashboard",
              dashboard: "agent",
              label: "Start your first agent",
            }}
            arrow="→"
            accent="emerald"
          />
          <AudienceCard
            tag="02 / Merchants"
            title="Selling APIs"
            subtitle="Monetize per call. No invoicing, no chasing."
            bullets={[
              "One middleware line returns 402 + quotes the price.",
              "x402-solana settles on-chain before your handler runs.",
              "USDC accrues in a dedicated payout wallet — no custody risk.",
              "Cash out to bank via Dodo payouts (v2) or swap yourself today.",
            ]}
            cta={{
              kind: "link",
              href: "/merchants",
              label: "For API providers",
            }}
            arrow="↗"
            accent="amber"
          />
        </div>
      </div>
    </section>
  );
}

// CTA descriptor for an AudienceCard. Either a static href (for cross-links
// like "/merchants" landing) or an auth-aware smart CTA that sends the user
// to a specific dashboard when signed in.
type AudienceCta =
  | { kind: "link"; href: string; label: string }
  | { kind: "dashboard"; dashboard: "agent" | "merchant"; label: string };

function AudienceCard({
  tag,
  title,
  subtitle,
  bullets,
  cta,
  arrow,
  accent,
}: {
  tag: string;
  title: string;
  subtitle: string;
  bullets: string[];
  cta: AudienceCta;
  arrow: "→" | "↗";
  accent: "emerald" | "amber";
}) {
  const accentText =
    accent === "emerald" ? "text-emerald-400" : "text-amber-300";
  const accentBorder =
    accent === "emerald" ? "border-emerald-400/40" : "border-amber-300/40";
  const accentHover =
    accent === "emerald"
      ? "hover:border-emerald-400 hover:text-emerald-400"
      : "hover:border-amber-300 hover:text-amber-300";

  return (
    <article
      className={`group relative flex flex-col border border-zinc-800 bg-[#0b0b0d] p-8 transition hover:border-zinc-700 md:p-10`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 top-0 h-[2px] ${
          accent === "emerald" ? "bg-emerald-400" : "bg-amber-300"
        } opacity-30 transition group-hover:opacity-100`}
      />
      <div className={`font-mono text-[10px] uppercase tracking-[0.28em] ${accentText}`}>
        {tag}
      </div>
      <h3 className="mt-6 font-display text-[34px] font-light leading-[1.05] tracking-tight text-zinc-50 md:text-[44px]">
        {title}
      </h3>
      <p className="mt-4 max-w-sm text-[15px] leading-[1.6] text-zinc-400">
        {subtitle}
      </p>

      <ul className="mt-10 space-y-4 text-[14.5px] leading-[1.6] text-zinc-300">
        {bullets.map((b, i) => (
          <li key={i} className="flex gap-3">
            <span
              className={`mt-[9px] inline-block h-px w-4 shrink-0 ${
                accent === "emerald" ? "bg-emerald-400" : "bg-amber-300"
              }`}
            />
            <span className="text-zinc-300">{b}</span>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex items-end">
        {cta.kind === "dashboard" ? (
          <CtaLink dashboard={cta.dashboard} variant="inline" arrow={arrow}>
            {cta.label}
          </CtaLink>
        ) : (
          <Link
            href={cta.href}
            className={`inline-flex items-center gap-3 border-b py-1 font-mono text-[12px] uppercase tracking-[0.22em] text-zinc-300 transition ${accentBorder} ${accentHover}`}
          >
            <span>{cta.label}</span>
            <span aria-hidden="true">{arrow}</span>
          </Link>
        )}
      </div>
    </article>
  );
}

/* ========================================================================
   STACK STRIP — "built on" wordmarks as editorial labels
   ======================================================================== */

const stackItems = [
  { name: "Solana", role: "L1 settlement" },
  { name: "x402", role: "HTTP micropayments" },
  { name: "Dodo Payments", role: "Fiat MoR" },
  { name: "Privy", role: "Embedded wallets" },
  { name: "Helius", role: "RPC" },
  { name: "PayAI", role: "Facilitator" },
];

function StackStrip() {
  return (
    <section className="relative border-b border-zinc-800/60 bg-[#0a0a0a] py-16">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="grid grid-cols-12 items-center gap-8">
          <div className="col-span-12 md:col-span-3">
            <p className="rule-with-pip font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-400">
              <span>Section V — Built on</span>
            </p>
            <p className="mt-3 font-display text-xl italic text-zinc-400">
              Infra you already trust.
            </p>
          </div>
          <div className="col-span-12 md:col-span-9">
            <ul className="flex flex-wrap items-center gap-x-10 gap-y-6">
              {stackItems.map((s) => (
                <li key={s.name} className="group">
                  <div className="font-display text-[22px] font-light text-zinc-200 transition group-hover:text-emerald-300">
                    {s.name}
                  </div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-600">
                    {s.role}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ========================================================================
   NUMBERS — market sizing, stated with editorial restraint
   ======================================================================== */

const figures = [
  {
    value: "$1.7T",
    label: "Agentic commerce volume projected for 2030",
    source: "McKinsey · Accenture",
  },
  {
    value: "35M+",
    label: "x402 transactions already settled on Solana",
    source: "since Summer 2025",
  },
  {
    value: "46%",
    label: "of YC Spring 2025 were AI agent companies",
    source: "Y Combinator",
  },
  {
    value: "₹500",
    label: "minimum top-up to ship your first agent",
    source: "Payrail",
  },
];

function Numbers() {
  return (
    <section className="relative overflow-hidden border-b border-zinc-800/60 bg-[#08080a] py-28 lg:py-36">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="mb-16 max-w-2xl">
          <p className="rule-with-pip font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-400">
            <span>Section VI — The market, now</span>
          </p>
          <h2 className="mt-8 font-display text-[40px] font-light leading-[1.02] tracking-[-0.02em] text-zinc-50 md:text-[60px]">
            Agent commerce isn&apos;t{" "}
            <span className="italic text-zinc-500">theoretical.</span>
          </h2>
          <p className="mt-6 text-[15px] leading-[1.7] text-zinc-400">
            It&apos;s already happening. Payrail is the rail between the 900M
            Indians who transact in rupees and the agents that transact on
            Solana.
          </p>
        </div>

        <div className="grid grid-cols-1 divide-y divide-zinc-800 border-y border-zinc-800 md:grid-cols-4 md:divide-x md:divide-y-0">
          {figures.map((f, i) => (
            <div key={i} className="p-8">
              <div className="font-display text-[52px] font-light leading-none tracking-[-0.02em] text-emerald-gradient md:text-[64px]">
                {f.value}
              </div>
              <p className="mt-4 text-[13px] leading-[1.55] text-zinc-300">
                {f.label}
              </p>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-600">
                {f.source}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========================================================================
   FAQ
   ======================================================================== */

function FAQSection() {
  return (
    <section className="relative border-b border-zinc-800/60 bg-[#0a0a0a] py-28 lg:py-36">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="mb-12 grid grid-cols-12 items-end gap-8">
          <div className="col-span-12 md:col-span-4">
            <p className="rule-with-pip font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-400">
              <span>Section VII — FAQ</span>
            </p>
          </div>
          <div className="col-span-12 md:col-span-8">
            <h2 className="font-display text-[40px] font-light leading-[1.02] tracking-[-0.02em] text-zinc-50 md:text-[60px]">
              Questions, fielded{" "}
              <span className="italic text-zinc-500">in order.</span>
            </h2>
          </div>
        </div>
        <FAQ items={userFaqs} />
      </div>
    </section>
  );
}

const userFaqs: QA[] = [
  {
    q: "Does my user need a crypto wallet?",
    a: "No. Every agent gets its own embedded Solana wallet, provisioned on sign-up via Privy. Your users fund it with UPI or card. They never see a seed phrase or a browser extension.",
  },
  {
    q: "What stablecoin do agents actually hold?",
    a: "USDC on Solana devnet today, USDG on mainnet once it lists. The mint is set via env — swapping is a one-line change, and the SDK never cares which token it is.",
  },
  {
    q: "Who controls the money?",
    a: "The operator. Agent wallets are Privy-custodied with a delegated signer scoped to the Payrail backend. Every outgoing signature runs through a spend-cap check before being broadcast. No cap, no signature.",
  },
  {
    q: "What happens when an agent hits its monthly cap?",
    a: "The signer rejects further transactions with a clean 402 back to the agent, and the operator gets a dashboard alert. Caps are set per-agent and enforced off-chain in v1; the v2 roadmap migrates them into an Anchor program for trustless enforcement.",
  },
  {
    q: "What does it cost?",
    a: "Free during private beta. Production pricing is 2% platform fee on the fiat leg plus ~1% network + FX, surfaced upfront on the top-up screen. Merchants receive the full USDC amount minus Solana fees.",
  },
  {
    q: "Why India first?",
    a: "900M internet users, UPI as the default rail, and Dodo Payments as an MoR that handles GST, compliance, and payouts out of the box. That's a distribution edge Stripe + Bridge + Tempo don't have here. International support follows the same architecture.",
  },
];

/* ========================================================================
   FINAL CTA
   ======================================================================== */

function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-[#0a0a0a] py-32 lg:py-40">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/10 blur-[160px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,black_0%,transparent_70%)]"
      />

      <div className="relative mx-auto max-w-[1200px] px-6 text-center lg:px-10">
        <p className="rule-with-pip mx-auto inline-flex font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-400">
          <span>Issue End · Call to ship</span>
        </p>
        <h2 className="mt-10 font-display text-balance text-[54px] font-light leading-[0.98] tracking-[-0.025em] text-zinc-50 md:text-[104px]">
          Ship your agent{" "}
          <span className="italic text-emerald-gradient">this weekend.</span>
        </h2>
        <p className="mx-auto mt-8 max-w-xl text-[16px] leading-[1.7] text-zinc-400">
          Free during beta. Live in two minutes. The demo costs less than a
          chai.
        </p>
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          <CtaLink dashboard="agent" variant="primary" arrow="→" className="px-7">
            Start your first agent
          </CtaLink>
          <Link
            href="/merchants"
            className="group inline-flex items-center justify-between gap-3 border border-zinc-700 px-7 py-4 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
          >
            <span>For API providers</span>
            <span
              aria-hidden="true"
              className="text-zinc-500 transition-transform group-hover:translate-x-1"
            >
              ↗
            </span>
          </Link>
        </div>

        <p className="mt-16 font-mono text-[10px] uppercase tracking-[0.26em] text-zinc-600">
          Solana × Dodo · Shipped from India
        </p>
      </div>
    </section>
  );
}
