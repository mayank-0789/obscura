"use client";

import Link from "next/link";

export function MissingMerchantState() {
  return (
    <div className="mx-auto max-w-[720px] px-8 py-16">
      <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
        Not a merchant yet
      </div>
      <h1 className="text-[24px] font-medium tracking-tight text-zinc-50">
        You don&apos;t have a merchant account on this login.
      </h1>
      <p className="mt-4 text-[14px] leading-[1.65] text-zinc-400">
        Register as a merchant to get an Obscura-managed payout wallet, a live
        earnings dashboard, and ready-to-paste SDK snippets.
      </p>
      <Link
        href="/onboarding"
        className="mt-6 inline-flex items-center gap-2 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-300 transition hover:bg-emerald-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
      >
        Register as merchant
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
