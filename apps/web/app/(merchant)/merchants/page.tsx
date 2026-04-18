import Link from "next/link";
import { Nav } from "../../../components/marketing/nav";
import { Footer } from "../../../components/marketing/footer";
import { SectionLabel } from "../../../components/marketing/section-label";

export default function MerchantLandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 antialiased">
      <Nav variant="merchant" />
      <Hero />
      <Stats />
      <HowItWorks />
      <CodeExample />
      <Revenue />
      <MerchantFAQ />
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
    <section className="relative overflow-hidden border-b border-zinc-800/60">
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_85%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute left-1/2 top-[-280px] h-[560px] w-[960px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative mx-auto grid max-w-6xl gap-14 px-6 py-28 md:grid-cols-5 md:gap-10 md:py-36">
        <div className="md:col-span-3">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            For API providers
          </div>

          <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">
            Get paid when AI agents{" "}
            <span className="bg-gradient-to-r from-emerald-300 to-emerald-500 bg-clip-text text-transparent">
              call your API.
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-7 text-zinc-400">
            Wrap any paid route in one line of middleware. Earn USDG per call on
            Solana. Cash out to your bank account via Dodo Payments.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/merchants/dashboard"
              className="group inline-flex items-center gap-2 rounded-md bg-emerald-400 px-5 py-3 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-300"
            >
              Create merchant account
              <span
                className="transition group-hover:translate-x-0.5"
                aria-hidden="true"
              >
                →
              </span>
            </Link>
            <Link
              href="/docs/merchants/quickstart"
              className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900/60 px-5 py-3 text-sm font-semibold text-zinc-100 transition hover:border-zinc-600 hover:bg-zinc-800/80"
            >
              Read the docs
            </Link>
          </div>

          <p className="mt-6 flex items-center gap-2 text-sm text-zinc-500">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-4 w-4 text-emerald-400"
              aria-hidden="true"
            >
              <path
                d="M5 13l4 4L19 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            One line of middleware · USDG on Solana · Cash out via Dodo
          </p>
        </div>

        <div className="md:col-span-2">
          <EarningsPreview />
        </div>
      </div>
    </section>
  );
}

function EarningsPreview() {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-3">
        <span className="font-mono text-xs text-zinc-500">
          merchant · earnings
        </span>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          live
        </div>
      </div>
      <div className="p-5">
        <div className="mb-4">
          <div className="font-mono text-xs text-zinc-500">Today</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight text-zinc-100">
              $4.78
            </span>
            <span className="text-sm text-zinc-500">USDG · 239 calls</span>
          </div>
        </div>
        <div className="space-y-1 font-mono text-[12px] leading-6 text-zinc-400">
          <Row time="23:14" path="/article/123" amount="$0.02" />
          <Row time="23:14" path="/article/205" amount="$0.02" />
          <Row time="23:14" path="/search?q=ai" amount="$0.01" />
          <Row time="23:13" path="/article/089" amount="$0.02" />
          <Row time="23:13" path="/trending" amount="$0.005" />
        </div>
        <div className="mt-5 rounded-md border border-zinc-800 bg-zinc-900/40 p-3 text-xs text-zinc-400">
          <span className="text-zinc-500">Cash out:</span>{" "}
          <span className="text-zinc-200">$47.93</span>{" "}
          <span className="text-zinc-500">→ bank (via Dodo)</span>
        </div>
      </div>
    </div>
  );
}

function Row({
  time,
  path,
  amount,
}: {
  time: string;
  path: string;
  amount: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 text-zinc-600">{time}</span>
      <span className="flex-1 truncate text-zinc-300">{path}</span>
      <span className="text-emerald-400">{amount}</span>
    </div>
  );
}

/* ========================================================================
   STATS
   ======================================================================== */

function Stats() {
  const stats = [
    { value: "1 line", label: "Middleware integration" },
    { value: "$0.001+", label: "Minimum charge" },
    { value: "USDG", label: "Settlement currency" },
    { value: "Dodo", label: "Cash out to bank" },
  ];
  return (
    <section className="border-b border-zinc-800/60 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-px overflow-hidden rounded-xl border border-zinc-800 bg-zinc-800 md:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="bg-[#0a0a0a] p-8 transition hover:bg-zinc-950"
            >
              <div className="font-mono text-3xl font-semibold tracking-tight text-emerald-400 md:text-4xl">
                {s.value}
              </div>
              <div className="mt-3 text-sm font-medium text-zinc-100">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========================================================================
   HOW IT WORKS
   ======================================================================== */

function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "Register your API",
      desc: "Sign up, register the endpoint you want to monetize, and choose a price per call.",
      icon: "📝",
    },
    {
      num: "02",
      title: "Wrap with middleware",
      desc: "One line in your Express / Fastify / Hono app. Agents hitting the route now pay per call via X402.",
      icon: "🧩",
    },
    {
      num: "03",
      title: "Earn & cash out",
      desc: "USDG accumulates in your payout wallet. Cash out anytime to your bank account via Dodo Payments.",
      icon: "💸",
    },
  ];

  return (
    <section className="border-b border-zinc-800/60 py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-16 max-w-2xl">
          <SectionLabel>How merchants earn</SectionLabel>
          <h2 className="mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Three steps to agent revenue.
          </h2>
          <p className="mt-5 text-lg leading-7 text-zinc-400">
            No subscription pages, no card forms, no chargebacks. Just
            pay-per-call, settled on-chain.
          </p>
        </div>

        <div className="relative grid gap-6 md:grid-cols-3">
          <div
            className="pointer-events-none absolute left-[16%] right-[16%] top-[42px] hidden h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent md:block"
            aria-hidden="true"
          />
          {steps.map((step) => (
            <div
              key={step.num}
              className="relative rounded-xl border border-zinc-800 bg-zinc-950/60 p-8 transition hover:border-zinc-700 hover:bg-zinc-950"
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-xl">
                  {step.icon}
                </div>
                <div className="font-mono text-xs tracking-widest text-emerald-400">
                  — {step.num}
                </div>
              </div>
              <h3 className="text-xl font-semibold tracking-tight">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========================================================================
   CODE EXAMPLE
   ======================================================================== */

function CodeExample() {
  return (
    <section className="border-b border-zinc-800/60 py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <SectionLabel>Integration</SectionLabel>
            <h2 className="mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
              Add payments in{" "}
              <span className="text-emerald-400">one line.</span>
            </h2>
            <p className="mt-5 text-lg leading-7 text-zinc-400">
              Works with Express, Fastify, Hono, and any Node.js HTTP
              framework. Python and Go coming soon.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-zinc-400">
              <Bullet>Handles HTTP 402 + payment terms automatically</Bullet>
              <Bullet>Verifies on-chain via PayAI facilitator</Bullet>
              <Bullet>Charge per endpoint, per method, or per response</Bullet>
              <Bullet>Replay-safe via nonces + on-chain verification</Bullet>
            </ul>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link
                href="/merchants/dashboard"
                className="inline-flex items-center gap-2 rounded-md bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-300"
              >
                Create merchant account →
              </Link>
              <Link
                href="/docs/merchants/quickstart"
                className="inline-flex items-center gap-2 rounded-md border border-zinc-700 bg-zinc-900/60 px-4 py-2.5 text-sm font-medium text-zinc-100 hover:bg-zinc-800/80"
              >
                Full quickstart
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-3">
              <span className="font-mono text-xs text-zinc-500">server.ts</span>
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
                express
              </span>
            </div>
            <pre className="overflow-x-auto p-6 font-mono text-[13px] leading-6 text-zinc-300">
              <code>
                <span className="text-zinc-500">
                  {"// npm install @payrail/merchant-sdk"}
                </span>
                {"\n\n"}
                <span className="text-pink-400">import</span>{" "}
                <span className="text-zinc-200">express</span>{" "}
                <span className="text-pink-400">from</span>{" "}
                <span className="text-emerald-300">{"'express'"}</span>
                <span className="text-zinc-500">;</span>
                {"\n"}
                <span className="text-pink-400">import</span>{" "}
                <span className="text-zinc-200">{"{ payrail }"}</span>{" "}
                <span className="text-pink-400">from</span>{" "}
                <span className="text-emerald-300">
                  {"'@payrail/merchant-sdk'"}
                </span>
                <span className="text-zinc-500">;</span>
                {"\n\n"}
                <span className="text-pink-400">const</span>{" "}
                <span className="text-zinc-200">app</span>{" "}
                <span className="text-pink-400">=</span>{" "}
                <span className="text-sky-300">express</span>
                <span className="text-zinc-400">()</span>
                <span className="text-zinc-500">;</span>
                {"\n"}
                <span className="text-pink-400">const</span>{" "}
                <span className="text-zinc-200">pay</span>{" "}
                <span className="text-pink-400">=</span>{" "}
                <span className="text-sky-300">payrail</span>
                <span className="text-zinc-400">(</span>
                {"{ "}
                <span className="text-zinc-200">apiKey</span>
                <span className="text-zinc-500">:</span>{" "}
                <span className="text-zinc-200">process</span>
                <span className="text-zinc-500">.</span>
                <span className="text-zinc-200">env</span>
                <span className="text-zinc-500">.</span>
                <span className="text-zinc-200">PAYRAIL_KEY</span>
                {" }"}
                <span className="text-zinc-400">)</span>
                <span className="text-zinc-500">;</span>
                {"\n\n"}
                <span className="text-zinc-200">app</span>
                <span className="text-zinc-500">.</span>
                <span className="text-sky-300">get</span>
                <span className="text-zinc-400">(</span>
                <span className="text-emerald-300">{"'/article/:id'"}</span>
                <span className="text-zinc-500">,</span>
                {"\n"}
                {"  "}
                <span className="text-zinc-200">pay</span>
                <span className="text-zinc-500">.</span>
                <span className="text-sky-300">charge</span>
                <span className="text-zinc-400">(</span>
                {"{ "}
                <span className="text-zinc-200">amount</span>
                <span className="text-zinc-500">:</span>{" "}
                <span className="text-emerald-300">{"'0.02'"}</span>
                {" }"}
                <span className="text-zinc-400">)</span>
                <span className="text-zinc-500">,</span>
                {"\n"}
                {"  "}
                <span className="text-zinc-400">(</span>
                <span className="text-zinc-200">req</span>
                <span className="text-zinc-500">,</span>{" "}
                <span className="text-zinc-200">res</span>
                <span className="text-zinc-400">)</span>{" "}
                <span className="text-pink-400">{"=>"}</span>{" "}
                <span className="text-zinc-200">res</span>
                <span className="text-zinc-500">.</span>
                <span className="text-sky-300">json</span>
                <span className="text-zinc-400">(</span>
                <span className="text-zinc-200">article</span>
                <span className="text-zinc-400">)</span>
                <span className="text-zinc-500">,</span>
                {"\n"}
                <span className="text-zinc-400">)</span>
                <span className="text-zinc-500">;</span>
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400"
        aria-hidden="true"
      >
        <path
          d="M5 13l4 4L19 7"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>{children}</span>
    </li>
  );
}

/* ========================================================================
   REVENUE EXAMPLE
   ======================================================================== */

function Revenue() {
  return (
    <section className="border-b border-zinc-800/60 py-28">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 max-w-2xl">
          <SectionLabel>The economics</SectionLabel>
          <h2 className="mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Pay-per-call economics, finally.
          </h2>
          <p className="mt-5 text-lg leading-7 text-zinc-400">
            Stripe's per-transaction fees make micropayments impossible. X402
            on Solana makes them trivial.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <ScenarioCard
            title="What Stripe charges for $0.02"
            body="4% + $0.30 = $0.308. You lose money on every call."
            bad
          />
          <ScenarioCard
            title="What Payrail charges for $0.02"
            body="~$0.0001 Solana fee + 0% platform fee during beta. 99.5% hits your wallet."
          />
        </div>

        <div className="mt-10 rounded-xl border border-zinc-800 bg-zinc-950/60 p-8">
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-400">
            Example
          </div>
          <p className="text-lg leading-7 text-zinc-300">
            An agent hits your weather API 5,000 times a day at $0.01/call.
            That's{" "}
            <span className="font-semibold text-emerald-400">$50/day</span>,{" "}
            <span className="font-semibold text-emerald-400">
              $1,500/month
            </span>
            .
          </p>
          <p className="mt-2 text-sm text-zinc-500">
            With Stripe, that same traffic yields{" "}
            <span className="text-zinc-400">-$1,500/month</span> — you'd lose
            money.
          </p>
        </div>
      </div>
    </section>
  );
}

function ScenarioCard({
  title,
  body,
  bad,
}: {
  title: string;
  body: string;
  bad?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-8 ${
        bad
          ? "border-red-900/40 bg-red-950/20"
          : "border-emerald-900/40 bg-emerald-950/10"
      }`}
    >
      <div
        className={`font-mono text-xs uppercase tracking-[0.2em] ${
          bad ? "text-red-400" : "text-emerald-400"
        }`}
      >
        {bad ? "Legacy" : "Payrail"}
      </div>
      <h3 className="mt-3 text-xl font-semibold tracking-tight">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-zinc-300">{body}</p>
    </div>
  );
}

/* ========================================================================
   MERCHANT FAQ
   ======================================================================== */

function MerchantFAQ() {
  const faqs = [
    {
      q: "What if an agent doesn't pay?",
      a: "They don't get a response. Our middleware returns HTTP 402 until the X-Payment header is present and verified on-chain. You never serve unpaid requests.",
    },
    {
      q: "How do I cash out to my bank?",
      a: "Your USDG accumulates in your Solana payout wallet. Cash-out is powered by Dodo Payments' payout API — INR and USD supported, with tax-compliant invoicing out of the box.",
    },
    {
      q: "What about refunds and chargebacks?",
      a: "Because payments are per-call and settled on-chain, chargebacks as you know them don't exist. Disputes are rare (agents are deterministic) and handled via Dodo's MoR coverage on cash-out.",
    },
    {
      q: "Can I set different prices per endpoint?",
      a: "Yes. Each route can have its own `pay.charge({ amount: '...' })`. Prices can be dynamic (e.g., scale with response size or compute cost).",
    },
    {
      q: "Do I need to know Solana?",
      a: "No. The middleware abstracts everything. You just see USDG balance rising in your payout wallet. Cash-out converts it to fiat. Entirely opaque to the Solana layer if you want.",
    },
    {
      q: "Is X402 locked to Payrail?",
      a: "No — X402 is an open protocol. Our middleware is a thin, optional convenience. You can self-host, switch facilitators, or move off Payrail without changing the protocol on your API.",
    },
  ];

  return (
    <section className="border-b border-zinc-800/60 py-28">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-12 text-center">
          <SectionLabel>Merchant FAQ</SectionLabel>
          <h2 className="mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
            Questions from API builders.
          </h2>
        </div>
        <div className="space-y-3">
          {faqs.map((f) => (
            <details
              key={f.q}
              className="group rounded-lg border border-zinc-800 bg-zinc-950/60 open:border-zinc-700"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-sm font-medium text-zinc-100 transition hover:text-white">
                <span>{f.q}</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="h-4 w-4 shrink-0 text-zinc-500 transition group-open:rotate-45"
                  aria-hidden="true"
                >
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </summary>
              <div className="border-t border-zinc-800 px-6 py-5 text-sm leading-6 text-zinc-400">
                {f.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ========================================================================
   FINAL CTA
   ======================================================================== */

function FinalCTA() {
  return (
    <section className="border-b border-zinc-800/60 py-28">
      <div className="mx-auto max-w-4xl px-6">
        <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 to-zinc-950/20 p-12 text-center transition hover:border-emerald-400/40">
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-emerald-500/10 blur-3xl transition group-hover:bg-emerald-500/20"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -left-20 -bottom-20 h-52 w-52 rounded-full bg-emerald-500/10 blur-3xl transition group-hover:bg-emerald-500/20"
            aria-hidden="true"
          />
          <SectionLabel>Start earning</SectionLabel>
          <h3 className="mt-4 text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Your API, monetized in 5 minutes.
          </h3>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-zinc-400">
            Create an account. Register your endpoint. Drop in the middleware.
            Watch USDG roll in.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/merchants/dashboard"
              className="inline-flex items-center gap-2 rounded-md bg-emerald-400 px-5 py-3 text-sm font-semibold text-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-300"
            >
              Create merchant account →
            </Link>
            <Link
              href="/docs/merchants/quickstart"
              className="inline-flex items-center rounded-md border border-zinc-700 bg-zinc-900/60 px-5 py-3 text-sm font-semibold text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800/80"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
