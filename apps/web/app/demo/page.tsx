import Link from "next/link";
import { env } from "@/lib/env";
import { SectionMarker } from "@/components/ui/section-marker";
import { SignInButton } from "@/components/auth/sign-in-button";
import { DemoClient } from "./demo-client";

export const dynamic = "force-dynamic";

export default function DemoPage() {
  const configured = Boolean(env.DEMO_AGENT_API_KEY && env.DEMO_MERCHANT_URL);
  return (
    <div className="min-h-screen bg-[#0a0a0a] font-sans text-[#f5f5f5] antialiased">
      <DemoTopBar />

      <main className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 sm:py-12 lg:px-10 lg:py-16">
        <header className="mb-10 max-w-3xl sm:mb-12">
          <SectionMarker index="00" label="Live demo · Solana devnet" />
          <h1
            className="mt-8 text-balance md:mt-10"
            style={{
              fontSize: "clamp(28px, 7vw, 64px)",
              fontWeight: 500,
              letterSpacing: "-0.025em",
              lineHeight: 1.02,
            }}
          >
            Watch an AI agent pay a paywalled API,{" "}
            <span style={{ color: "#e63946" }}>without revealing</span> the
            amount or the recipient.
          </h1>
          <p className="mt-5 max-w-[64ch] text-[14px] leading-[1.6] text-[#888] sm:mt-6 sm:text-[15px]">
            Each click below triggers a real on-chain spend through the Umbra
            mixer. The agent debits its encrypted balance, lands a UTXO
            commitment in the mixer tree addressed to the merchant, and the
            merchant claims it asynchronously — so the on-chain link between
            payer and payee is broken, and the amount stays encrypted.
          </p>
        </header>

        <DemoClient configured={configured} />
      </main>

      <DemoFooter />
    </div>
  );
}

function DemoTopBar() {
  return (
    <header className="border-b border-[#1f1f1f]">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5 lg:px-10">
        <div className="flex min-w-0 items-baseline gap-3">
          <Link href="/" className="text-[15px] font-medium tracking-[-0.01em]">
            obscura
          </Link>
          <span className="hidden font-mono text-[10px] text-[#5a5a5a] sm:inline">───</span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-[#888] sm:inline">
            demo
          </span>
        </div>
        <nav className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.16em] sm:gap-7">
          <Link href="/" className="text-[#888] hover:text-[#f5f5f5]">
            home
          </Link>
          <Link href="/docs" className="text-[#888] hover:text-[#f5f5f5]">
            docs
          </Link>
          <SignInButton />
        </nav>
      </div>
    </header>
  );
}

function DemoFooter() {
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
