import { Nav } from "../../components/marketing/nav";
import { Footer } from "../../components/marketing/footer";
import { env } from "@/lib/env";
import { DemoClient } from "./demo-client";

// /demo — judge-facing live playground. One click triggers a real x402 spend
// from the operator's demo agent against the demo merchant, with each step
// of the Umbra-mixer dance streamed over SSE.

export const dynamic = "force-dynamic";

export default function DemoPage() {
  const configured = Boolean(env.DEMO_AGENT_API_KEY && env.DEMO_MERCHANT_URL);
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 antialiased">
      <Nav variant="user" />
      <main className="mx-auto max-w-[1400px] px-6 pt-12 pb-16 lg:px-10 lg:pt-16">
        <header className="mb-10 max-w-3xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-emerald-400/80">
            Live demo · Solana devnet
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-[-0.02em] text-zinc-50 lg:text-5xl">
            Watch an AI agent pay a paywalled API,{" "}
            <span className="text-emerald-300">without revealing</span> the
            amount or the recipient.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-zinc-400">
            Each click below triggers a real on-chain spend through the Umbra
            mixer. The agent debits its encrypted balance, lands a UTXO
            commitment in the mixer tree addressed to the merchant, and the
            merchant claims it asynchronously — so the on-chain link between
            payer and payee is broken, and the amount stays encrypted.
          </p>
        </header>

        <DemoClient configured={configured} />
      </main>
      <Footer />
    </div>
  );
}
