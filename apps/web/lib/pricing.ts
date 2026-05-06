import { convertInrToUsdg } from "@/lib/rates";

const BPS_DENOM = 10_000n;

// Service fee (incl 18% GST) — net margin after Dodo + GST is ~3.5%.
const SERVICE_FEE_BPS = 625n;

// Quoted rate = marketRate × (1 + RATE_SPREAD_BPS / DENOM); cost recovery only.
const RATE_SPREAD_BPS = 60n;

export type TopupBreakdown = {
  paidPaise: bigint;
  serviceFeePaise: bigint;
  conversionPaise: bigint;
  marketRate: number;
  quotedRate: number;
  usdgMicros: bigint;
};

export function calculateTopupBreakdown(
  paidPaise: bigint,
  marketRate: number,
): TopupBreakdown {
  const serviceFeePaise = (paidPaise * SERVICE_FEE_BPS) / BPS_DENOM;
  const conversionPaise = paidPaise - serviceFeePaise;

  const quotedRate =
    marketRate * (1 + Number(RATE_SPREAD_BPS) / Number(BPS_DENOM));
  const usdgMicros = convertInrToUsdg(conversionPaise, quotedRate);

  return {
    paidPaise,
    serviceFeePaise,
    conversionPaise,
    marketRate,
    quotedRate,
    usdgMicros,
  };
}

export type TopupBreakdownDTO = {
  paidPaise: string;
  serviceFeePaise: string;
  conversionPaise: string;
  marketRate: number;
  quotedRate: number;
  usdgMicros: string;
};

export function serializeBreakdown(b: TopupBreakdown): TopupBreakdownDTO {
  return {
    paidPaise: b.paidPaise.toString(),
    serviceFeePaise: b.serviceFeePaise.toString(),
    conversionPaise: b.conversionPaise.toString(),
    marketRate: b.marketRate,
    quotedRate: b.quotedRate,
    usdgMicros: b.usdgMicros.toString(),
  };
}

export const SERVICE_FEE_PERCENT =
  Number(SERVICE_FEE_BPS) / Number(BPS_DENOM) * 100;
