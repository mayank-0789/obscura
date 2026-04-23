import Link from "next/link";

export default function DocsIndexPage() {
  return (
    <article className="mx-auto max-w-[720px]">
      <div className="mb-8 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.28em] text-emerald-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
        Payrail Docs
      </div>

      <h1 className="font-display text-[54px] font-light leading-[1.02] tracking-[-0.02em] text-zinc-50">
        Build with the rail, on{" "}
        <span className="italic text-emerald-gradient">either side.</span>
      </h1>

      <p className="mt-6 text-[17px] leading-[1.65] text-zinc-300">
        Payrail turns stablecoin settlement on Solana into a single HTTP call.
        Your agent <code className="font-mono text-emerald-400">fetch()</code>
        s a paid API and the payment handshake happens automatically — no
        wallets in your agent code, no crypto knowledge required.
      </p>

      <section className="mt-14 grid gap-5 md:grid-cols-2">
        <QuickstartCard
          kicker="01 / For agent developers"
          title="Ship an agent that pays for APIs."
          body="Install @payrail-app/sdk, drop in your agent's API key, point fetch at a paid endpoint. Payrail handles signing, spend caps, and retries on your behalf."
          href="/docs/agents/quickstart"
          cta="Read the agent quickstart"
        />
        <QuickstartCard
          kicker="02 / For API providers"
          title="Monetize any route in one line."
          body="Install @payrail-app/merchant-sdk, wrap an Express route with pay.charge({ amount }). The PayAI facilitator verifies and settles payments on Solana. You get USDC in your payout wallet."
          href="/docs/merchants/quickstart"
          cta="Read the merchant quickstart"
        />
      </section>

      <section className="mt-16 border-t border-zinc-800 pt-10">
        <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">
          What you&apos;ll need
        </div>
        <ul className="space-y-3 text-[15px] leading-[1.6] text-zinc-300">
          <Bullet>
            <strong className="text-zinc-100">Node 18 or later.</strong> Both
            SDKs target modern Node + edge runtimes. Older Node needs a
            polyfilled <code className="font-mono text-zinc-400">fetch</code>.
          </Bullet>
          <Bullet>
            <strong className="text-zinc-100">A Payrail account.</strong>{" "}
            <Link
              href="/onboarding"
              className="text-emerald-400 hover:underline"
            >
              Sign in
            </Link>{" "}
            with Google and pick a role. Agents get a custodied Solana wallet; merchants
            get a managed payout wallet. Either way, you never hold a
            keypair yourself.
          </Bullet>
          <Bullet>
            <strong className="text-zinc-100">
              No crypto-native tooling needed.
            </strong>{" "}
            No Phantom, no seed phrase, no <code className="font-mono text-zinc-400">solana-keygen</code>.
            Fund agents in rupees via UPI or card; cash out merchants to
            bank (soon) via Dodo.
          </Bullet>
        </ul>
      </section>

      <section className="mt-14 border-t border-zinc-800 pt-10">
        <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">
          Where things live
        </div>
        <div className="grid gap-6 text-[14px] text-zinc-400 sm:grid-cols-2">
          <div>
            <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-300">
              GitHub
            </div>
            <a
              href="https://github.com/mayank-0789/payrail"
              className="text-emerald-400 hover:underline"
            >
              github.com/mayank-0789/payrail ↗
            </a>
            <p className="mt-1 text-[13px] text-zinc-500">
              Monorepo. SDKs live under{" "}
              <code className="font-mono">packages/</code>.
            </p>
          </div>
          <div>
            <div className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-300">
              Dashboard
            </div>
            <Link
              href="/dashboard"
              className="text-emerald-400 hover:underline"
            >
              /dashboard
            </Link>
            <p className="mt-1 text-[13px] text-zinc-500">
              Create agents, top up, grab API keys, watch spend.
            </p>
          </div>
        </div>
      </section>
    </article>
  );
}

function QuickstartCard({
  kicker,
  title,
  body,
  href,
  cta,
}: {
  kicker: string;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between border border-zinc-800 bg-[#0c0c0e] p-6 transition hover:border-emerald-400/40 hover:bg-[#0e1311]"
    >
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-400">
          {kicker}
        </p>
        <h2 className="mt-4 font-display text-[24px] font-light leading-[1.2] tracking-tight text-zinc-50">
          {title}
        </h2>
        <p className="mt-3 text-[14px] leading-[1.6] text-zinc-400">{body}</p>
      </div>
      <div className="mt-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400 transition group-hover:text-emerald-400">
        <span>{cta}</span>
        <span
          aria-hidden="true"
          className="transition-transform group-hover:translate-x-1"
        >
          →
        </span>
      </div>
    </Link>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-[10px] inline-block h-px w-4 shrink-0 bg-emerald-400"
      />
      <span>{children}</span>
    </li>
  );
}
