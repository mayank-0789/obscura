"use client";

import { formatUsdg, STABLECOIN_TICKER } from "@/lib/money-format";
import type { MerchantMeResponse } from "@/hooks/use-merchant";
import { StatCell } from "@/components/ui/stat-cell";
import { SectionMarker } from "@/components/ui/section-marker";

type Props = {
  stats: MerchantMeResponse["stats"] | undefined;
};

/**
 * Hackathon-grade placeholder series for sparklines. The MerchantMe payload
 * doesn't ship time-series, so we render a deterministic decorative line per
 * cell — the visual is a Tufte stat block, not a real chart.
 */
const PLACEHOLDER_GROWTH = [2, 3, 3, 5, 7, 8, 12, 15, 18, 22, 28, 33];
const PLACEHOLDER_FLAT = [8, 9, 10, 11, 11, 12, 12, 13, 14, 15, 16, 17];
const PLACEHOLDER_STEP = [1, 1, 2, 2, 3, 4, 5, 6, 8, 10, 13, 16];
const PLACEHOLDER_RECENT = [3, 4, 4, 5, 6, 6, 7, 9, 11, 13, 14, 15];

export function MerchantStatsStrip({ stats }: Props) {
  // `== null` guard distinguishes loading (em-dash) from real $0.00.
  const total = stats?.totalEarnedUsdg;
  const thisMo = stats?.thisMonthEarnedUsdg;
  const calls = stats?.callsCount;
  const payers = stats?.uniquePayersCount;

  const cells = [
    {
      index: "fig. 1.1",
      value: total == null ? "—" : `$${formatUsdg(total)}`,
      label: "Total earned",
      source: STABLECOIN_TICKER,
      spark: PLACEHOLDER_GROWTH,
    },
    {
      index: "fig. 1.2",
      value: thisMo == null ? "—" : `$${formatUsdg(thisMo)}`,
      label: "This month",
      source: STABLECOIN_TICKER,
      spark: PLACEHOLDER_RECENT,
      accent: true,
    },
    {
      index: "fig. 1.3",
      value: calls == null ? "—" : calls.toLocaleString("en-US"),
      label: "Paid calls",
      source: "lifetime",
      spark: PLACEHOLDER_STEP,
    },
    {
      index: "fig. 1.4",
      value: payers == null ? "—" : payers.toLocaleString("en-US"),
      label: "Unique payers",
      source: "distinct agents",
      spark: PLACEHOLDER_FLAT,
    },
  ];

  return (
    <section>
      <SectionMarker index="01" label="This month" />
      <div
        className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        style={{ borderTop: "1px solid #f5f5f5" }}
      >
        {cells.map((c, i) => {
          const lastInRow = (i + 1) % 4 === 0;
          return (
          <div
            key={c.index}
            className="lg:[border-right:var(--mr-lg)]"
            style={
              {
                borderBottom: "1px solid #1f1f1f",
                ["--mr-lg" as string]:
                  !lastInRow && i < cells.length - 1 ? "1px solid #1f1f1f" : "none",
              } as React.CSSProperties
            }
          >
            <StatCell
              index={c.index}
              value={c.value}
              label={c.label}
              source={c.source}
              spark={c.spark}
              accent={c.accent}
              compact
            />
          </div>
          );
        })}
      </div>
    </section>
  );
}
