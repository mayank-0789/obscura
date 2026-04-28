import Link from "next/link";
import { Nav } from "../../../components/marketing/nav";
import { Footer } from "../../../components/marketing/footer";
import { CtaLink } from "../../../components/marketing/cta-link";
import { FAQ, type QA } from "../../../components/marketing/landing/faq";
import { MerchantCodeEditor } from "../../../components/marketing/landing/merchant-code-editor";
import { EarningsCard } from "../../../components/marketing/landing/earnings-card";

export default function MerchantLandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 antialiased">
      <Nav variant="merchant" />
      <Hero />
      <Stats />
      <HowItWorks />
      <Quickstart />
      <Economics />
      <FAQSection />
      <FinalCTA />
      <Footer />
    </div>
  );
}

/* ========================================================================
   HERO
   ======================================================================== */

function Hero() {
  return (
    <section className="bg-noise relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_85%_65%_at_75%_0%,black_10%,transparent_75%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-40 h-[560px] w-[560px] rounded-full bg-emerald-500/10 blur-[140px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 top-80 h-[380px] w-[380px] rounded-full bg-emerald-500/5 blur-[120px]"
      />

      <div className="relative mx-auto grid max-w-[1400px] grid-cols-12 gap-x-8 gap-y-16 px-6 pb-28 pt-24 lg:px-10 lg:pb-36 lg:pt-32">
        <div className="col-span-12 md:col-span-8">
          <p className="rule-with-pip mb-10 font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-400">
            <span>For API providers</span>
          </p>

          <h1 className="font-display text-balance text-[56px] font-light leading-[0.94] tracking-[-0.03em] text-zinc-50 md:text-[96px] lg:text-[118px]">
            <span className="reveal block" style={{ animationDelay: "0.05s" }}>
              Get paid when
            </span>
            <span className="reveal block" style={{ animationDelay: "0.15s" }}>
              agents{" "}
              <span className="italic text-emerald-gradient">
                call your API.
              </span>
            </span>
          </h1>

          <p
            className="reveal mt-12 max-w-[60ch] text-[18px] leading-[1.65] text-zinc-300 md:text-[20px] md:leading-[1.6]"
            style={{ animationDelay: "0.35s" }}
          >
            Drop one line of middleware into your server. Earn{" "}
            <span className="text-zinc-100">USDC on Solana</span> per request.
            Cash out to your bank via Dodo — no subscription pages, no
            chargebacks.
          </p>

          <div
            className="reveal mt-10 flex flex-col gap-3 sm:flex-row"
            style={{ animationDelay: "0.5s" }}
          >
            <CtaLink dashboard="merchant" variant="primary" arrow="→">
              Create merchant account
            </CtaLink>
            <Link
              href="/docs/merchants/quickstart"
              className="group inline-flex items-center justify-between gap-3 border border-zinc-700 bg-transparent px-6 py-4 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
            >
              <span>Read the docs</span>
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
            <Stat label="Integration" value="1 line" />
            <Stat label="Min. charge" value="$0.001" />
            <Stat label="Platform fee (beta)" value="0%" />
          </div>
        </div>

        <aside
          className="reveal col-span-12 md:col-span-4"
          style={{ animationDelay: "0.25s" }}
        >
          <div className="md:sticky md:top-28">
            <EarningsCard />
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">
              Synthetic example. Live dashboard wakes up on sign-up.
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
   STATS — figures row
   ======================================================================== */

const figures = [
  { value: "1 line", label: "To integrate. Express, Fastify, Hono supported." },
  { value: "$0.001", label: "Smallest viable charge. Solana fees ≈ zero." },
  { value: "USDC", label: "Settled on-chain, per request, verifiable." },
  { value: "T+0", label: "Cash out via Dodo payouts — bank in hours, not days." },
];

function Stats() {
  return (
    <section className="border-b border-zinc-800/60 bg-[#08080a] py-24">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="grid grid-cols-1 divide-y divide-zinc-800 border-y border-zinc-800 md:grid-cols-4 md:divide-x md:divide-y-0">
          {figures.map((f) => (
            <div key={f.value} className="p-8">
              <div className="font-display text-[48px] font-light leading-none tracking-[-0.02em] text-emerald-gradient md:text-[58px]">
                {f.value}
              </div>
              <p className="mt-4 text-[13px] leading-[1.55] text-zinc-400">
                {f.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========================================================================
   HOW IT WORKS — three actor-style cards
   ======================================================================== */

function HowItWorks() {
  return (
    <section className="border-b border-zinc-800/60 bg-[#0a0a0a] py-28 lg:py-36">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="mb-16 max-w-2xl">
          <p className="rule-with-pip font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-400">
            <span>Section I — How merchants earn</span>
          </p>
          <h2 className="mt-8 font-display text-balance text-[44px] font-light leading-[1.02] tracking-[-0.02em] text-zinc-50 md:text-[60px]">
            Register. Wrap.{" "}
            <span className="italic text-emerald-gradient">Earn.</span>
          </h2>
          <p className="mt-6 max-w-xl text-[15px] leading-[1.7] text-zinc-400">
            No subscription pages. No card forms. No chargebacks. Just
            pay-per-call, settled on-chain, cashable in rupees.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <StepCard
            kicker="01 · Register"
            title="Connect your endpoints."
            body="Sign up, register the routes you want to monetize, and set a price per call. Dynamic pricing supported — scale with response size or compute cost."
            meta="One-time setup · ~2 min"
          />
          <StepCard
            kicker="02 · Wrap"
            title="Drop in the middleware."
            body="One line in your Express, Fastify, or Hono app. Agents hitting the route now pay per call via x402 before your handler runs."
            meta="One line · Python + Go next"
          />
          <StepCard
            kicker="03 · Earn"
            title="Watch USDC accrue."
            body="Payments land in your Solana payout wallet on every request. Cash out to your bank via Dodo — INR and USD, GST-compliant invoicing included."
            meta="Per request · Settles on-chain"
          />
        </div>
      </div>
    </section>
  );
}

function StepCard({
  kicker,
  title,
  body,
  meta,
}: {
  kicker: string;
  title: string;
  body: string;
  meta: string;
}) {
  return (
    <article className="flex h-full flex-col border border-zinc-800 bg-[#0c0c0e] p-7 md:p-8">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-400">
        {kicker}
      </p>
      <h3 className="mt-8 font-display text-[28px] font-light leading-[1.15] tracking-tight text-zinc-50 md:text-[30px]">
        {title}
      </h3>
      <p className="mt-4 text-[14.5px] leading-[1.65] text-zinc-400">{body}</p>
      <div className="mt-auto flex items-center gap-4 border-t border-zinc-800/80 pt-5">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-600">
          When
        </span>
        <span className="font-mono text-[11.5px] text-zinc-300">{meta}</span>
      </div>
    </article>
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
              <span>Section II — Integration</span>
            </p>
            <h2 className="mt-8 font-display text-[40px] font-light leading-[1.02] tracking-[-0.02em] text-zinc-50 md:text-[54px]">
              Payments in{" "}
              <span className="italic text-emerald-gradient">one line.</span>
            </h2>
            <p className="mt-6 text-[15px] leading-[1.7] text-zinc-400">
              Works with Express, Fastify, and Hono out of the box. Python and
              Go middlewares ship next.
            </p>

            <ul className="mt-10 space-y-4 text-[14px] text-zinc-300">
              <BulletLine>
                <strong className="text-zinc-100">402 handled for you.</strong>{" "}
                Middleware returns payment terms, verifies{" "}
                <code className="font-mono text-zinc-400">X-Payment</code>,
                runs your handler.
              </BulletLine>
              <BulletLine>
                <strong className="text-zinc-100">On-chain verification.</strong>{" "}
                The middleware reads the queue tx via Solana RPC before we
                serve a byte.
              </BulletLine>
              <BulletLine>
                <strong className="text-zinc-100">
                  Nonces prevent replay.
                </strong>{" "}
                No one pays twice. No one pays zero.
              </BulletLine>
              <BulletLine>
                <strong className="text-zinc-100">Per-endpoint pricing.</strong>{" "}
                Static, dynamic, or computed. Yours to decide.
              </BulletLine>
            </ul>

            <div className="mt-10 flex flex-wrap gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
              <Link
                href="/docs/merchants/quickstart"
                className="inline-flex items-center gap-2 border-b border-zinc-700 pb-0.5 transition hover:border-emerald-400 hover:text-emerald-400"
              >
                Read the quickstart
                <span aria-hidden>→</span>
              </Link>
              <span className="text-zinc-700">/</span>
              <Link
                href="https://github.com/mayank-0789/obscura"
                className="inline-flex items-center gap-2 border-b border-zinc-700 pb-0.5 transition hover:border-emerald-400 hover:text-emerald-400"
              >
                View on GitHub
                <span aria-hidden>↗</span>
              </Link>
            </div>
          </div>

          <div className="col-span-12 md:col-span-7 lg:col-span-8">
            <MerchantCodeEditor />
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
   ECONOMICS — why pay-per-call finally works
   ======================================================================== */

function Economics() {
  return (
    <section className="border-b border-zinc-800/60 bg-[#08080a] py-28 lg:py-36">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="mb-16 max-w-2xl">
          <p className="rule-with-pip font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-400">
            <span>Section III — The economics</span>
          </p>
          <h2 className="mt-8 font-display text-balance text-[44px] font-light leading-[1.02] tracking-[-0.02em] text-zinc-50 md:text-[60px]">
            Micropayments, finally,{" "}
            <span className="italic text-emerald-gradient">profitable.</span>
          </h2>
          <p className="mt-6 max-w-xl text-[15px] leading-[1.7] text-zinc-400">
            Card processors charge a floor of $0.30 per transaction. That
            kills pay-per-call at any realistic price. Solana fees are
            ~$0.0001. You keep the rest.
          </p>
        </div>

        <div className="grid gap-0 md:grid-cols-2">
          <ScenarioCard
            tone="legacy"
            tag="Legacy — Stripe"
            headline="You lose money per call."
            stat="$0.02 charged → $0.308 in fees"
            detail="4% + $0.30 means the floor is $0.31 before you break even. Micropayments don't work here."
          />
          <ScenarioCard
            tone="obscura"
            tag="Obscura — Solana + x402"
            headline="99.5% lands in your wallet."
            stat="$0.02 charged → $0.0001 in fees"
            detail="Solana settlement + 0% platform fee during beta. The merchant SDK is open-source and verification is a single Solana RPC call your server makes — no third party in the loop."
          />
        </div>

        <div className="mt-10 border border-zinc-800 bg-[#0c0c0e] p-8 md:p-10">
          <div className="rule-with-pip mb-6 font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-400">
            <span>A realistic scenario</span>
          </div>
          <p className="max-w-4xl font-display text-[24px] font-light leading-[1.45] tracking-tight text-zinc-100 md:text-[32px]">
            An agent hits your weather API{" "}
            <span className="text-emerald-gradient">5,000 times a day</span> at
            $0.01 a call. On Obscura that&apos;s{" "}
            <span className="text-emerald-gradient">$50/day</span> —{" "}
            <span className="text-emerald-gradient">$1,500/month</span> — in
            your wallet.
          </p>
          <p className="mt-4 max-w-3xl text-[14px] leading-[1.7] text-zinc-400">
            With Stripe, the same traffic yields{" "}
            <span className="text-zinc-300">minus $1,500 a month</span>. You
            would pay to serve those calls.
          </p>
        </div>
      </div>
    </section>
  );
}

function ScenarioCard({
  tone,
  tag,
  headline,
  stat,
  detail,
}: {
  tone: "legacy" | "obscura";
  tag: string;
  headline: string;
  stat: string;
  detail: string;
}) {
  const accentText =
    tone === "obscura" ? "text-emerald-400" : "text-rose-400";
  const borderSide =
    tone === "obscura"
      ? "border-l md:border-l-0 md:border-r"
      : "border-l md:border-l";
  return (
    <article
      className={`flex flex-col border border-zinc-800 ${borderSide} bg-[#0c0c0e] p-8 md:p-10`}
    >
      <p
        className={`font-mono text-[10px] uppercase tracking-[0.28em] ${accentText}`}
      >
        {tag}
      </p>
      <h3 className="mt-6 font-display text-[28px] font-light leading-[1.15] tracking-tight text-zinc-50 md:text-[34px]">
        {headline}
      </h3>
      <div
        className={`mt-8 font-mono text-[13px] leading-[1.6] ${accentText}`}
      >
        {stat}
      </div>
      <p className="mt-3 text-[14px] leading-[1.65] text-zinc-400">{detail}</p>
    </article>
  );
}

/* ========================================================================
   FAQ
   ======================================================================== */

const merchantFaqs: QA[] = [
  {
    q: "What if an agent doesn't pay?",
    a: "They don't get a response. The middleware returns HTTP 402 with payment terms and only runs your handler after the X-Payment header is verified on-chain. You never serve unpaid requests.",
  },
  {
    q: "How do I cash out to a bank?",
    a: "USDC accrues in your Solana payout wallet. Cash-out routes through Dodo's payout API — INR and USD supported, GST-compliant invoicing, MoR coverage, typical settlement within hours.",
  },
  {
    q: "What about refunds and chargebacks?",
    a: "Payments are per-call and settled on-chain, so chargebacks in the card sense don't exist. Agents are deterministic, disputes are rare, and Dodo provides MoR coverage on the cash-out leg.",
  },
  {
    q: "Can I price different endpoints differently?",
    a: "Yes. Each route has its own pay.charge({ amount }). Prices can be static, dynamic (scaled with response size / compute), or computed on the fly inside the handler.",
  },
  {
    q: "Do I need to know Solana?",
    a: "No. The middleware abstracts it entirely. You watch a USDC balance rise in your payout wallet and click cash-out when you want rupees. The Solana layer is opaque if you want it to be.",
  },
  {
    q: "Is x402 locked to Obscura?",
    a: "No. x402 is an open protocol. Our middleware is a thin convenience layer — verification is a public Solana RPC call your server makes, the SDK is self-hostable, and removable without changing the protocol your API already speaks.",
  },
];

function FAQSection() {
  return (
    <section className="border-b border-zinc-800/60 bg-[#0a0a0a] py-28 lg:py-36">
      <div className="mx-auto max-w-[1400px] px-6 lg:px-10">
        <div className="mb-12 grid grid-cols-12 items-end gap-8">
          <div className="col-span-12 md:col-span-4">
            <p className="rule-with-pip font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-400">
              <span>Section IV — FAQ</span>
            </p>
          </div>
          <div className="col-span-12 md:col-span-8">
            <h2 className="font-display text-[40px] font-light leading-[1.02] tracking-[-0.02em] text-zinc-50 md:text-[60px]">
              Questions, from{" "}
              <span className="italic text-zinc-500">API builders.</span>
            </h2>
          </div>
        </div>
        <FAQ items={merchantFaqs} />
      </div>
    </section>
  );
}

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
          <span>Issue End · Start earning</span>
        </p>
        <h2 className="mt-10 font-display text-balance text-[54px] font-light leading-[0.98] tracking-[-0.025em] text-zinc-50 md:text-[104px]">
          Monetize your API{" "}
          <span className="italic text-emerald-gradient">this weekend.</span>
        </h2>
        <p className="mx-auto mt-8 max-w-xl text-[16px] leading-[1.7] text-zinc-400">
          Free during beta. One middleware line. USDC in your wallet before
          your next standup.
        </p>
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          <CtaLink
            dashboard="merchant"
            variant="primary"
            arrow="→"
            className="px-7"
          >
            Create merchant account
          </CtaLink>
          <Link
            href="/docs/merchants/quickstart"
            className="group inline-flex items-center justify-between gap-3 border border-zinc-700 px-7 py-4 text-sm font-medium text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-100"
          >
            <span>Read the docs</span>
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
