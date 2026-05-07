"use client";

import type { TopupBreakdown } from "@/lib/pricing";
import { SERVICE_FEE_PERCENT } from "@/lib/pricing";
import {
  formatInrExact,
  formatUsdg,
  STABLECOIN_TICKER,
} from "@/lib/money-format";

type RateSource = "live" | "cached" | "fallback";

type Props = {
  breakdown: TopupBreakdown | null;
  rateSource: RateSource;
  loading: boolean;
};

export function BreakdownCard({ breakdown, rateSource, loading }: Props) {
  if (loading || !breakdown) {
    return (
      <div className="border-b border-zinc-800 bg-[#0a0a0a] px-4 py-5 sm:px-6">
        <div className="h-20 animate-pulse rounded bg-zinc-900/40" />
      </div>
    );
  }

  const { paidPaise, serviceFeePaise, usdgMicros, quotedRate } = breakdown;

  return (
    <div className="border-b border-zinc-800 bg-[#0a0a0a] px-4 py-5 sm:px-6">
      <dl className="space-y-2.5">
        <Row label="Top-up amount" amountInr={paidPaise} bold />

        <Row
          label={`Service fee  (${SERVICE_FEE_PERCENT}%, incl. GST)`}
          amountInr={-serviceFeePaise}
        />

        <div className="h-px bg-zinc-800/80" />

        <div className="flex items-baseline justify-between">
          <span className="text-[13px] text-zinc-400">Agent receives</span>
          <span className="font-mono text-[17px] font-semibold tabular-nums text-zinc-50">
            ${formatUsdg(usdgMicros)}{" "}
            <span className="text-[12px] font-normal text-zinc-500">
              {STABLECOIN_TICKER}
            </span>
          </span>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-500">
        <span className="font-mono">
          ₹{quotedRate.toFixed(2)} / USD
        </span>
        <RateBadge source={rateSource} />
      </div>
    </div>
  );
}

function Row({
  label,
  amountInr,
  bold,
}: {
  label: string;
  amountInr: bigint;
  bold?: boolean;
}) {
  const isNegative = amountInr < 0n;
  const abs = isNegative ? -amountInr : amountInr;
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[12.5px] text-zinc-300">{label}</span>
      <span
        className={`font-mono tabular-nums ${
          bold
            ? "text-[13px] font-medium text-zinc-100"
            : "text-[12.5px] text-zinc-300"
        }`}
      >
        {isNegative ? "−" : ""}₹{formatInrExact(abs)}
      </span>
    </div>
  );
}

function RateBadge({ source }: { source: RateSource }) {
  if (source === "fallback") {
    return (
      <span className="font-mono text-amber-400/80">fallback rate</span>
    );
  }
  if (source === "cached") {
    return <span className="font-mono">cached · 15 min</span>;
  }
  return <span className="font-mono text-emerald-400">live rate</span>;
}
