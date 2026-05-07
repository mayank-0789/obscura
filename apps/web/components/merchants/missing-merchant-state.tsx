"use client";

import Link from "next/link";
import { SectionMarker } from "@/components/ui/section-marker";

export function MissingMerchantState() {
  return (
    <div className="mx-auto max-w-[720px] px-8 py-16">
      <SectionMarker index="00" label="Not a merchant yet" />
      <h1
        className="mt-8 text-[28px] text-[#f5f5f5] md:text-[32px]"
        style={{ fontWeight: 500, letterSpacing: "-0.025em", lineHeight: 1.05 }}
      >
        You don&apos;t have a merchant account on this login.
      </h1>
      <p className="mt-5 max-w-[58ch] text-[14px] leading-[1.65] text-[#888]">
        Register as a merchant to get an Obscura-managed payout wallet, a live
        earnings dashboard, and ready-to-paste SDK snippets.
      </p>
      <Link
        href="/onboarding?upgrade=1"
        className="mt-8 inline-flex items-center gap-2 border-b pb-1 font-mono text-[11px] uppercase tracking-[0.18em] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e63946]"
        style={{ borderColor: "#e63946", color: "#e63946" }}
      >
        register as merchant
        <span aria-hidden>→</span>
      </Link>
    </div>
  );
}
