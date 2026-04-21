"use client";

import { formatUsdg, STABLECOIN_TICKER } from "@/lib/money-format";
import type { MerchantMeResponse } from "@/hooks/use-merchant";

type Props = {
  stats: MerchantMeResponse["stats"] | undefined;
};

// 4-stat strip at the top of the merchant dashboard. Stats arrive as
// bigint-strings or integer counts — we format + render. During initial
// load (stats === undefined) we show em-dashes so the strip holds its
// vertical rhythm before data arrives.
export function MerchantStatsStrip({ stats }: Props) {
  // Guard with `== null` (presence) instead of truthiness — a real $0.00
  // reading from the backend (`totalEarnedUsdg === "0"`) is truthy as a
  // string but would have been truthy as `0` too, and we want to SHOW
  // "$0.00" for a new merchant, not em-dashes. The only em-dash state
  // should be "still loading."
  const total = stats?.totalEarnedUsdg;
  const thisMo = stats?.thisMonthEarnedUsdg;
  const calls = stats?.callsCount;
  const payers = stats?.uniquePayersCount;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatCell
        label="Total earned"
        value={total == null ? "—" : `$${formatUsdg(total)}`}
        hint={STABLECOIN_TICKER}
      />
      <StatCell
        label="This month"
        value={thisMo == null ? "—" : `$${formatUsdg(thisMo)}`}
        hint={STABLECOIN_TICKER}
      />
      <StatCell
        label="Paid calls"
        value={calls == null ? "—" : calls.toLocaleString("en-US")}
      />
      <StatCell
        label="Unique payers"
        value={payers == null ? "—" : payers.toLocaleString("en-US")}
      />
    </div>
  );
}

function StatCell({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-[#0c0c0e] p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-mono text-[22px] tabular-nums text-zinc-50">
          {value}
        </span>
        {hint ? (
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">
            {hint}
          </span>
        ) : null}
      </div>
    </div>
  );
}
