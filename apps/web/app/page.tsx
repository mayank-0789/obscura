import Link from "next/link";
import { Nav } from "../components/marketing/nav";
import { Footer } from "../components/marketing/footer";
import { SectionLabel } from "../components/marketing/section-label";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 antialiased">
      <Nav variant="user" />
      <Hero />
      <HowItWorks />
      <CodeExample />
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
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_80%)]"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-5xl px-6 py-36 md:py-48">
        <div className="max-w-3xl">
          <div className="mb-8 inline-flex items-center gap-2 text-xs text-zinc-500">
            <span className="h-1 w-1 rounded-full bg-emerald-400" />
            Built for Colosseum Frontier 2026
          </div>

          <h1 className="text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            The payment rail for AI agents.
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-7 text-zinc-400">
            Fund your agent with UPI or card. It pays for APIs autonomously —
            stablecoin settlement on Solana, no crypto wallet needed.
          </p>

          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-md bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-300"
            >
              Start your first agent
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/merchants"
              className="inline-flex items-center rounded-md px-4 py-2.5 text-sm font-medium text-zinc-400 transition hover:text-zinc-100"
            >
              For API providers
            </Link>
          </div>
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
      title: "You fund",
      desc: "Top up with UPI or card via Dodo Payments.",
    },
    {
      num: "02",
      title: "Your agent spends",
      desc: "Autonomously pays for APIs via X402 on Solana.",
    },
    {
      num: "03",
      title: "Merchants earn",
      desc: "USDG per call. Cash out to bank via Dodo.",
    },
  ];

  return (
    <section className="border-b border-zinc-800/60 py-32">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-16 max-w-xl">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight">
            Fiat in. Stablecoins out.
          </h2>
        </div>

        <div className="grid gap-12 md:grid-cols-3 md:gap-8">
          {steps.map((step) => (
            <div key={step.num}>
              <div className="font-mono text-xs tracking-widest text-emerald-400">
                — {step.num}
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-zinc-400">
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
    <section className="border-b border-zinc-800/60 py-32">
      <div className="mx-auto max-w-5xl px-6">
        <div className="mb-12 max-w-xl">
          <SectionLabel>Quickstart</SectionLabel>
          <h2 className="mt-4 text-balance text-4xl font-semibold leading-tight tracking-tight">
            A spending account in 3 lines.
          </h2>
          <p className="mt-4 text-zinc-400">
            Drop the SDK into your agent. We handle the rest.
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/50 px-4 py-3">
            <span className="font-mono text-xs text-zinc-500">agent.ts</span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
              typescript
            </span>
          </div>
          <pre className="overflow-x-auto p-6 font-mono text-[13px] leading-7 text-zinc-300">
            <code>
              <span className="text-pink-400">import</span>{" "}
              <span className="text-zinc-200">{"{ Payrail }"}</span>{" "}
              <span className="text-pink-400">from</span>{" "}
              <span className="text-emerald-300">{"'@payrail/sdk'"}</span>
              <span className="text-zinc-500">;</span>
              {"\n\n"}
              <span className="text-pink-400">const</span>{" "}
              <span className="text-zinc-200">agent</span>{" "}
              <span className="text-pink-400">=</span>{" "}
              <span className="text-pink-400">new</span>{" "}
              <span className="text-amber-300">Payrail</span>
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
              <span className="text-pink-400">const</span>{" "}
              <span className="text-zinc-200">data</span>{" "}
              <span className="text-pink-400">=</span>{" "}
              <span className="text-pink-400">await</span>{" "}
              <span className="text-zinc-200">agent</span>
              <span className="text-zinc-500">.</span>
              <span className="text-sky-300">fetch</span>
              <span className="text-zinc-400">(</span>
              <span className="text-emerald-300">
                {"'https://news-api.com/latest'"}
              </span>
              <span className="text-zinc-400">)</span>
              <span className="text-zinc-500">;</span>
            </code>
          </pre>
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
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-balance text-4xl font-semibold leading-tight tracking-tight">
          Ready to ship?
        </h2>
        <p className="mt-4 text-zinc-400">
          Free during beta. Live in 2 minutes.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-md bg-emerald-400 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-300"
          >
            Start your first agent
            <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/merchants"
            className="inline-flex items-center rounded-md px-4 py-2.5 text-sm font-medium text-zinc-400 transition hover:text-zinc-100"
          >
            For API providers
          </Link>
        </div>
      </div>
    </section>
  );
}
