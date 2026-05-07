import Link from "next/link";
import { SectionMarker } from "@/components/ui/section-marker";

export default function DocsIndexPage() {
  return (
    <article className="mx-auto max-w-[760px]">
      <SectionMarker index="00" label="Obscura docs" />

      <h1
        className="mt-10 text-balance"
        style={{
          fontSize: "clamp(36px, 5vw, 56px)",
          fontWeight: 500,
          letterSpacing: "-0.025em",
          lineHeight: 1.02,
        }}
      >
        Build with the rail,
        <br />
        <span style={{ color: "#888", fontWeight: 300 }}>on either side.</span>
      </h1>

      <p className="mt-8 max-w-[64ch] text-[15.5px] leading-[1.65] text-[#888]">
        Obscura turns stablecoin settlement on Solana into a single HTTP call.
        Your agent{" "}
        <code className="font-mono text-[#f5f5f5]">fetch()</code>s a paid API
        and the payment handshake happens automatically — no wallets in your
        agent code, no crypto knowledge required.
      </p>

      <section className="mt-14 grid grid-cols-1 gap-px md:grid-cols-2">
        <QuickstartCard
          tag="for agents"
          accent
          title="Ship an agent that pays for APIs."
          body="Install @obscura-app/sdk, drop in your agent's API key, point fetch at a paid endpoint. Obscura handles signing, spend caps, and retries on your behalf."
          href="/docs/agents/quickstart"
          cta="Read the agent quickstart"
        />
        <QuickstartCard
          tag="for merchants"
          title="Monetize any route in one line."
          body="Install @obscura-app/merchant-sdk, wrap an Express route with pay.charge({ amount }). The middleware returns x402 challenges and verifies confidential mixer payments on-chain via Solana RPC."
          href="/docs/merchants/quickstart"
          cta="Read the merchant quickstart"
        />
      </section>

      <section
        className="mt-20 pt-10"
        style={{ borderTop: "1px solid #1f1f1f" }}
      >
        <SectionMarker index="01" label="What you'll need" />
        <ul className="mt-8 space-y-4 text-[14.5px] leading-[1.65] text-[#888]">
          <Bullet>
            <strong className="font-medium text-[#f5f5f5]">
              Node 18 or later.
            </strong>{" "}
            Both SDKs target modern Node + edge runtimes. Older Node needs a
            polyfilled <code className="font-mono text-[#f5f5f5]">fetch</code>.
          </Bullet>
          <Bullet>
            <strong className="font-medium text-[#f5f5f5]">
              An Obscura account.
            </strong>{" "}
            <Link
              href="/onboarding"
              className="border-b border-[#f5f5f5] pb-px text-[#f5f5f5]"
            >
              Sign in
            </Link>{" "}
            with Google and pick a role. Agents get a custodied Solana wallet;
            merchants get a managed payout wallet. Either way, you never hold
            a keypair yourself.
          </Bullet>
          <Bullet>
            <strong className="font-medium text-[#f5f5f5]">
              No crypto-native tooling needed.
            </strong>{" "}
            No Phantom, no seed phrase, no{" "}
            <code className="font-mono text-[#f5f5f5]">solana-keygen</code>.
            Fund agents in rupees via UPI or card; cash out merchants to bank
            (soon) via Dodo.
          </Bullet>
        </ul>
      </section>

      <section
        className="mt-20 pt-10"
        style={{ borderTop: "1px solid #1f1f1f" }}
      >
        <SectionMarker index="02" label="Where things live" />
        <div
          className="mt-10 grid grid-cols-1 sm:grid-cols-2"
          style={{ borderTop: "1px solid #f5f5f5" }}
        >
          <div
            className="px-5 py-7"
            style={{
              borderBottom: "1px solid #1f1f1f",
              borderRight: "1px solid #1f1f1f",
            }}
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
              fig. 2.1 · github
            </div>
            <a
              href="https://github.com/mayank-0789/obscura"
              className="mt-4 block font-mono text-[14px] text-[#f5f5f5]"
            >
              github.com/mayank-0789/obscura{" "}
              <span aria-hidden className="text-[#888]">
                ↗
              </span>
            </a>
            <p className="mt-3 text-[13px] leading-[1.55] text-[#888]">
              Monorepo. SDKs live under{" "}
              <code className="font-mono text-[#f5f5f5]">packages/</code>.
            </p>
          </div>
          <div
            className="px-5 py-7"
            style={{ borderBottom: "1px solid #1f1f1f" }}
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
              fig. 2.2 · dashboard
            </div>
            <Link
              href="/dashboard"
              className="mt-4 block font-mono text-[14px] text-[#f5f5f5]"
            >
              /dashboard
            </Link>
            <p className="mt-3 text-[13px] leading-[1.55] text-[#888]">
              Create agents, top up, grab API keys, watch spend.
            </p>
          </div>
        </div>
      </section>
    </article>
  );
}

function QuickstartCard({
  tag,
  title,
  body,
  href,
  cta,
  accent = false,
}: {
  tag: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col justify-between border border-[#1f1f1f] p-7 transition hover:bg-[#0e0e0e]"
    >
      <div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em]">
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: accent ? "#e63946" : "#f5f5f5" }}
          />
          <span className="text-[#888]">{tag}</span>
        </div>
        <h2
          className="mt-5"
          style={{
            fontSize: 22,
            fontWeight: 500,
            letterSpacing: "-0.015em",
            lineHeight: 1.2,
          }}
        >
          {title}
        </h2>
        <p className="mt-3 text-[13.5px] leading-[1.65] text-[#888]">{body}</p>
      </div>
      <div
        className="mt-8 inline-flex items-center gap-2 self-start border-b pb-1 font-mono text-[11px] uppercase tracking-[0.18em]"
        style={{
          borderColor: accent ? "#e63946" : "#f5f5f5",
          color: accent ? "#e63946" : "#f5f5f5",
        }}
      >
        <span>{cta}</span>
        <span aria-hidden>→</span>
      </div>
    </Link>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-[10px] inline-block h-px w-3 shrink-0"
        style={{ backgroundColor: "#f5f5f5" }}
      />
      <span>{children}</span>
    </li>
  );
}
