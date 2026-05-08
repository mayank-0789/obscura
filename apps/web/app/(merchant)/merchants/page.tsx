import Link from "next/link";
import type { CSSProperties } from "react";
import { Sparkline } from "@/components/ui/sparkline";
import { SectionMarker } from "@/components/ui/section-marker";
import { CtaLink } from "@/components/marketing/cta-link";
import { SignInButton } from "@/components/auth/sign-in-button";

export default function MerchantLandingPage() {
  return (
    <div
      className="min-h-screen bg-[#0a0a0a] font-sans text-[#f5f5f5] antialiased"
      style={{ fontFeatureSettings: '"ss01", "cv11", "tnum"' } as CSSProperties}
    >
      <TopBar />
      <Hero />
      <Numbers />
      <HowItWorks />
      <Quickstart />
      <Economics />
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
            /merchants
          </span>
        </div>
        <nav className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.16em] sm:gap-7">
          <Link href="/" className="text-[#888] hover:text-[#f5f5f5]">
            home
          </Link>
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


const ACCRUAL_SERIES = [
  0, 0.4, 1.1, 2.2, 3.6, 5.4, 7.5, 10.0, 12.8, 16.0, 19.6, 23.6, 28.0, 32.8,
  38.0, 43.6, 49.6, 56.0, 62.8, 70.0, 77.6, 85.6,
];

function Hero() {
  return (
    <section className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-10">
      <div className="grid grid-cols-12 gap-6 pt-14 pb-12 sm:pt-20 md:pt-24 md:pb-16 lg:pt-32 lg:pb-24">
        <div className="col-span-12 md:col-span-7">
          <SectionMarker index="00" label="For API providers" />
          <h1
            className="mt-8 text-balance md:mt-12"
            style={{
              fontSize: "clamp(36px, 9vw, 96px)",
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 0.96,
            }}
          >
            Get paid when
            <br />
            agents call
            <br />
            <span style={{ color: "#888", fontWeight: 300 }}>your API.</span>
          </h1>
          <p className="mt-8 max-w-[58ch] text-[15px] leading-[1.6] text-[#888] sm:text-[16px] md:mt-10">
            Drop one line of middleware into your server. Earn USDC on Solana
            per request, settled inside encrypted balances via Umbra. Cash out
            to your bank through Dodo — no subscription pages, no chargebacks.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4 font-mono text-[11px] uppercase tracking-[0.18em] sm:gap-x-8 md:mt-12">
            <CtaLink dashboard="merchant">create merchant account</CtaLink>
            <Link
              href="/docs/merchants/quickstart"
              className="inline-flex items-center gap-2 border-b border-[#888] pb-1 text-[#888] hover:border-[#f5f5f5] hover:text-[#f5f5f5]"
            >
              read the docs <span aria-hidden>↗</span>
            </Link>
            <span className="hidden text-[#888] sm:inline">npm i @obscura-app/merchant-sdk</span>
          </div>
        </div>

        <aside className="col-span-12 md:col-span-5 md:pt-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
            Fig. 0 · USDC accrual, single endpoint
          </p>
          <p className="mt-1 text-[12px] text-[#888]">
            5,000 calls/day @ $0.01 · synthetic 22-day window
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
              values={ACCRUAL_SERIES}
              width={480}
              height={110}
              area
              endDot
              className="!block !h-[110px] !w-full"
            />
          </div>
          <div className="mt-4 grid grid-cols-3 font-mono text-[10px] uppercase tracking-[0.16em] text-[#888]">
            <span>t-22d</span>
            <span className="text-center">today</span>
            <span className="text-right tabular-nums">$85.60</span>
          </div>
          <p className="mt-8 max-w-[36ch] text-[12.5px] leading-[1.6] text-[#888]">
            <span className="text-[#f5f5f5]">
              Live dashboard wakes up on sign-up.
            </span>{" "}
            Cash-out routes through Dodo — INR or USD.
          </p>
        </aside>
      </div>

      <div
        className="grid grid-cols-12 gap-x-4 gap-y-3 py-6 font-mono text-[10px] uppercase tracking-[0.16em] text-[#888] sm:gap-6 sm:py-7 sm:text-[11px] sm:tracking-[0.18em]"
        style={{
          borderTop: "1px solid #f5f5f5",
          borderBottom: "1px solid #1f1f1f",
        }}
      >
        {[
          ["01", "the numbers"],
          ["02", "register · wrap · earn"],
          ["03", "one line"],
          ["04", "economics"],
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
    value: "1 line",
    label: "To integrate. Express, Fastify, Hono supported.",
    source: "@obscura-app/merchant-sdk",
    spark: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  {
    value: "$0.001",
    label: "Smallest viable charge. Solana fees ≈ zero.",
    source: "Solana mainnet",
    spark: [50, 40, 30, 22, 16, 11, 7, 4, 2, 1, 0.5, 0.1],
  },
  {
    value: "USDC",
    label: "Settled on-chain, per request, verifiable.",
    source: "via Umbra mixer commitments",
    spark: [2, 4, 7, 11, 16, 22, 29, 37, 46, 56, 67, 79],
  },
  {
    value: "T+0",
    label: "Cash out via Dodo payouts — bank in hours.",
    source: "INR · USD · GST-compliant",
    spark: [80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80, 80],
  },
];

function Numbers() {
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-20 md:py-24 lg:px-10 lg:py-28">
      <SectionMarker index="01" label="The numbers" />
      <h2
        className="mt-8 max-w-[28ch] md:mt-10"
        style={{
          fontSize: "clamp(28px, 5vw, 48px)",
          fontWeight: 500,
          letterSpacing: "-0.025em",
          lineHeight: 1.05,
        }}
      >
        Pay-per-call, finally cheap enough to ship.
      </h2>
      <p className="mt-4 max-w-[56ch] text-[14px] leading-[1.6] text-[#888] sm:text-[15px] md:mt-5">
        The card-network floor of $0.30 per transaction made micropayments a
        fantasy. Solana settlement and a 0% beta platform fee remove it.
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
                borderRight:
                  !isLastInRow && i < FIGURES.length - 1
                    ? "1px solid #1f1f1f"
                    : undefined,
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


function HowItWorks() {
  return (
    <section
      className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-20 md:py-24 lg:px-10 lg:py-28"
      style={{ borderTop: "1px solid #1f1f1f" }}
    >
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-4">
          <SectionMarker index="02" label="Register · wrap · earn" />
          <h2
            className="mt-8 md:mt-10"
            style={{
              fontSize: "clamp(28px, 5vw, 48px)",
              fontWeight: 500,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
            }}
          >
            Three steps. <br />
            <span className="text-[#888]">No card forms.</span>
          </h2>
          <p className="mt-5 max-w-[42ch] text-[14px] leading-[1.6] text-[#888] sm:mt-6 sm:text-[15px]">
            No subscription pages, no chargebacks. Pay-per-call, settled
            on-chain inside encrypted balances, cashable in rupees.
          </p>
        </div>
        <div className="col-span-12 grid grid-cols-1 gap-px md:col-span-8 md:grid-cols-3">
          <StepColumn
            n="01"
            tag="register"
            title="Connect endpoints."
            blurb="Sign up, register the routes you want to monetize, set a price per call."
            bullets={[
              "Static, dynamic, or computed pricing",
              "Scale with response size or compute cost",
              "One-time setup · ~2 min",
            ]}
          />
          <StepColumn
            n="02"
            tag="wrap"
            title="Drop in the middleware."
            blurb="One line in your Express, Fastify, or Hono app — agents pay per call before your handler runs."
            bullets={[
              "Returns 402 with payment terms",
              "Verifies X-Payment via Solana RPC",
              "Python and Go middlewares ship next",
            ]}
            accent
          />
          <StepColumn
            n="03"
            tag="earn"
            title="Watch USDC accrue."
            blurb="Payments land in your encrypted Umbra balance per request. Cash out to your bank through Dodo."
            bullets={[
              "INR and USD payouts",
              "GST-compliant invoicing",
              "Settles on-chain, per request",
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function StepColumn({
  n,
  tag,
  title,
  blurb,
  bullets,
  accent = false,
}: {
  n: string;
  tag: string;
  title: string;
  blurb: string;
  bullets: string[];
  accent?: boolean;
}) {
  return (
    <article className="flex flex-col border border-[#1f1f1f] p-5 sm:p-7">
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em]">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: accent ? "#e63946" : "#f5f5f5" }}
        />
        <span className="text-[#888]">
          {n} · {tag}
        </span>
      </div>
      <h3
        className="mt-5"
        style={{
          fontSize: 20,
          fontWeight: 500,
          letterSpacing: "-0.015em",
          lineHeight: 1.15,
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
    </article>
  );
}


function Quickstart() {
  return (
    <section
      className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-20 md:py-24 lg:px-10 lg:py-28"
      style={{ borderTop: "1px solid #1f1f1f" }}
    >
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 md:col-span-5">
          <SectionMarker index="03" label="One line" />
          <h2
            className="mt-8 md:mt-10"
            style={{
              fontSize: "clamp(28px, 5vw, 48px)",
              fontWeight: 500,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
            }}
          >
            Payments in <br />
            <span className="text-[#888]">one line.</span>
          </h2>
          <p className="mt-5 max-w-[42ch] text-[14px] leading-[1.6] text-[#888] sm:mt-6 sm:text-[15px]">
            Works with Express, Fastify, and Hono out of the box. Python and
            Go middlewares ship next.
          </p>

          <ul className="mt-8 space-y-4 text-[13.5px] leading-[1.6] sm:mt-10">
            <BulletLine>
              <strong className="font-medium text-[#f5f5f5]">
                402 handled for you.
              </strong>{" "}
              <span className="text-[#888]">
                Middleware returns payment terms, verifies{" "}
              </span>
              <code className="font-mono text-[12.5px] text-[#f5f5f5]">
                X-Payment
              </code>
              <span className="text-[#888]">, runs your handler.</span>
            </BulletLine>
            <BulletLine>
              <strong className="font-medium text-[#f5f5f5]">
                On-chain verification.
              </strong>{" "}
              <span className="text-[#888]">
                The middleware reads the queue tx via Solana RPC before we
                serve a byte.
              </span>
            </BulletLine>
            <BulletLine>
              <strong className="font-medium text-[#f5f5f5]">
                Nonces prevent replay.
              </strong>{" "}
              <span className="text-[#888]">
                No one pays twice. No one pays zero.
              </span>
            </BulletLine>
            <BulletLine>
              <strong className="font-medium text-[#f5f5f5]">
                Per-endpoint pricing.
              </strong>{" "}
              <span className="text-[#888]">
                Static, dynamic, or computed. Yours to decide.
              </span>
            </BulletLine>
          </ul>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 font-mono text-[11px] uppercase tracking-[0.18em]">
            <Link
              href="/docs/merchants/quickstart"
              className="inline-flex items-center gap-2 border-b border-[#f5f5f5] pb-1 text-[#f5f5f5] hover:border-[#e63946] hover:text-[#e63946]"
            >
              read the quickstart <span aria-hidden>→</span>
            </Link>
            <Link
              href="https://github.com/mayank-0789/obscura"
              className="inline-flex items-center gap-2 border-b border-[#888] pb-1 text-[#888] hover:border-[#f5f5f5] hover:text-[#f5f5f5]"
            >
              github <span aria-hidden>↗</span>
            </Link>
          </div>
        </div>

        <aside className="col-span-12 md:col-span-7 md:pt-2">
          <div className="overflow-x-auto border border-[#1f1f1f] p-5 font-mono text-[12px] leading-[1.7] text-[#f5f5f5] sm:p-6 sm:text-[12.5px]">
            <span className="text-[#888]">$</span> npm i @obscura-app/merchant-sdk
            <br />
            <br />
            <span className="text-[#888]">// server.ts</span>
            <br />
            <span style={{ color: "#e63946" }}>import</span> express{" "}
            <span style={{ color: "#e63946" }}>from</span>{" "}
            <span className="text-[#888]">&quot;express&quot;</span>;
            <br />
            <span style={{ color: "#e63946" }}>import</span>{" "}
            {"{ "}paywall{" }"}{" "}
            <span style={{ color: "#e63946" }}>from</span>{" "}
            <span className="text-[#888]">&quot;@obscura-app/merchant-sdk&quot;</span>;
            <br />
            <br />
            <span style={{ color: "#e63946" }}>const</span> app = express();
            <br />
            <br />
            app.get(
            <span className="text-[#888]">&quot;/forecast&quot;</span>,
            <br />
            &nbsp;&nbsp;paywall(
            {"{ "}price: <span className="text-[#888]">&quot;$0.01&quot;</span>{" }"}),
            <br />
            &nbsp;&nbsp;(req, res) =&gt; res.json(
            {"{ "}temp: 27{" }"}),
            <br />
            );
            <br />
            <br />
            app.listen(3000);
          </div>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
            Fig. 3.1 · the entire integration
          </p>
        </aside>
      </div>
    </section>
  );
}

function BulletLine({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className="mt-[10px] inline-block h-px w-3 shrink-0 bg-[#f5f5f5]"
      />
      <span>{children}</span>
    </li>
  );
}


function Economics() {
  return (
    <section
      className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 sm:py-20 md:py-24 lg:px-10 lg:py-28"
      style={{ borderTop: "1px solid #1f1f1f" }}
    >
      <SectionMarker index="04" label="Economics" />
      <h2
        className="mt-8 max-w-[24ch] md:mt-10"
        style={{
          fontSize: "clamp(28px, 5vw, 48px)",
          fontWeight: 500,
          letterSpacing: "-0.025em",
          lineHeight: 1.05,
        }}
      >
        Micropayments, finally, profitable.
      </h2>
      <p className="mt-4 max-w-[58ch] text-[14px] leading-[1.6] text-[#888] sm:text-[15px] md:mt-5">
        Card processors charge a floor of $0.30 per transaction. That kills
        pay-per-call at any realistic price. Solana fees are ~$0.0001. You
        keep the rest.
      </p>

      <div
        className="mt-10 grid grid-cols-1 md:mt-14 md:grid-cols-2"
        style={{ borderTop: "1px solid #f5f5f5" }}
      >
        <ScenarioCell
          tag="legacy · stripe"
          headline="You lose money per call."
          stat="$0.02 charged → $0.308 in fees"
          detail="4% + $0.30 means the floor is $0.31 before you break even. Micropayments don't work here."
          tone="legacy"
          rightBorder
        />
        <ScenarioCell
          tag="obscura · solana + x402"
          headline="99.5% lands in your wallet."
          stat="$0.02 charged → $0.0001 in fees"
          detail="Solana settlement + 0% platform fee during beta. The merchant SDK is open-source; verification is a single Solana RPC call your server makes — no third party in the loop."
          tone="obscura"
        />
      </div>

      <div
        className="mt-10 border border-[#1f1f1f] px-5 py-7 sm:mt-12 sm:px-7 sm:py-9 md:px-10 md:py-12"
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
          Fig. 4.1 · A realistic scenario
        </div>
        <p
          className="mt-6 max-w-[64ch] text-balance"
          style={{
            fontSize: "clamp(20px, 3.2vw, 32px)",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            lineHeight: 1.25,
          }}
        >
          An agent hits your weather API{" "}
          <span className="text-[#888]">5,000 times a day</span> at $0.01 a
          call. On Obscura that&apos;s{" "}
          <span style={{ color: "#e63946" }}>$50/day</span> —{" "}
          <span style={{ color: "#e63946" }}>$1,500/month</span> — in your
          wallet.
        </p>
        <p className="mt-5 max-w-[64ch] text-[13.5px] leading-[1.65] text-[#888] sm:text-[14px]">
          With Stripe, the same traffic yields{" "}
          <span className="text-[#f5f5f5]">minus $1,500 a month</span>. You
          would pay to serve those calls.
        </p>
      </div>
    </section>
  );
}

function ScenarioCell({
  tag,
  headline,
  stat,
  detail,
  tone,
  rightBorder = false,
}: {
  tag: string;
  headline: string;
  stat: string;
  detail: string;
  tone: "legacy" | "obscura";
  rightBorder?: boolean;
}) {
  const accent = tone === "obscura" ? "#e63946" : "#888";
  return (
    <article
      className="flex flex-col px-5 py-7 sm:px-7 sm:py-9"
      style={{
        borderBottom: "1px solid #1f1f1f",
        borderRight: rightBorder ? "1px solid #1f1f1f" : undefined,
      }}
    >
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em]">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: accent }}
        />
        <span className="text-[#888]">{tag}</span>
      </div>
      <h3
        className="mt-5"
        style={{
          fontSize: "clamp(22px, 3vw, 30px)",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
        }}
      >
        {headline}
      </h3>
      <div
        className="mt-7 font-mono text-[12.5px] leading-[1.6] tabular-nums"
        style={{ color: accent }}
      >
        {stat}
      </div>
      <p className="mt-3 text-[13.5px] leading-[1.65] text-[#888]">{detail}</p>
    </article>
  );
}


const FAQ_ITEMS = [
  {
    q: "What if an agent doesn't pay?",
    a: "They don't get a response. The middleware returns HTTP 402 with payment terms and only runs your handler after the X-Payment header is verified on-chain. You never serve unpaid requests.",
  },
  {
    q: "How do I cash out to a bank?",
    a: "USDC accrues in your encrypted Umbra balance. Cash-out routes through Dodo's payout API — INR and USD supported, GST-compliant invoicing, MoR coverage, typical settlement within hours.",
  },
  {
    q: "What about refunds and chargebacks?",
    a: "Payments are per-call and settled on-chain, so chargebacks in the card sense don't exist. Agents are deterministic, disputes are rare, and Dodo provides MoR coverage on the cash-out leg.",
  },
  {
    q: "Can I price different endpoints differently?",
    a: "Yes. Each route has its own paywall({ price }). Prices can be static, dynamic (scaled with response size / compute), or computed on the fly inside the handler.",
  },
  {
    q: "Do I need to know Solana?",
    a: "No. The middleware abstracts it entirely. You watch a USDC balance rise in your encrypted account and click cash-out when you want rupees. The Solana layer is opaque if you want it to be.",
  },
  {
    q: "Is x402 locked to Obscura?",
    a: "No. x402 is an open protocol. Our middleware is a thin convenience layer — verification is a public Solana RPC call your server makes, the SDK is self-hostable, and removable without changing the protocol your API already speaks.",
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
          <SectionMarker index="05" label="FAQ" />
          <h2
            className="mt-8 md:mt-10"
            style={{
              fontSize: "clamp(26px, 5vw, 44px)",
              fontWeight: 500,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
            }}
          >
            Questions, from API builders.
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
          <SectionMarker index="06" label="Ship" />
          <h2
            className="mt-8 text-balance md:mt-10"
            style={{
              fontSize: "clamp(32px, 8vw, 80px)",
              fontWeight: 500,
              letterSpacing: "-0.035em",
              lineHeight: 0.98,
            }}
          >
            Monetize your API
            <br />
            <span style={{ color: "#888", fontWeight: 300 }}>
              this weekend.
            </span>
          </h2>
          <p className="mt-6 max-w-[44ch] text-[14px] leading-[1.6] text-[#888] sm:text-[15px] md:mt-8">
            Free during beta. One middleware line. USDC in your wallet before
            your next standup.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-4 font-mono text-[11px] uppercase tracking-[0.18em] sm:gap-x-8 md:mt-12">
            <CtaLink dashboard="merchant">create merchant account</CtaLink>
            <Link
              href="/docs/merchants/quickstart"
              className="inline-flex items-center gap-2 border-b border-[#888] pb-1 text-[#888] hover:border-[#f5f5f5] hover:text-[#f5f5f5]"
            >
              read the docs <span aria-hidden>↗</span>
            </Link>
          </div>
        </div>
        <aside className="col-span-12 md:col-span-5 md:pt-2">
          <div className="overflow-x-auto border border-[#1f1f1f] p-5 font-mono text-[11.5px] leading-[1.7] text-[#f5f5f5] sm:p-6 sm:text-[12px]">
            <span className="text-[#888]">$</span> npm i @obscura-app/merchant-sdk
            <br />
            <span className="text-[#888]">$</span> export OBSCURA_PAYOUT=...
            <br />
            <br />
            app.use(paywall(&#123; price:{" "}
            <span style={{ color: "#e63946" }}>&quot;$0.01&quot;</span> &#125;));
            <br />
            <span className="text-[#888]">// you&apos;re live.</span>
          </div>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
            Fig. 6.1 · the entire integration
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
