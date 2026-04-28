// Top-up pricing — single source of truth for quote API + webhook credit +
// UI breakdown. Deterministic for (paidPaise, marketRate).
//
// Product framing: Obscura sells a "platform service + payment conversion".
// The service portion is GSTable; the converted principal is pass-through.
// See memory `project_topup_pricing.md` for the full model rationale.
//
// ⚠ MAINNET BLOCKER: this math assumes the Dodo product is configured with a
// non-SaaS tax category so GST is NOT extracted from the full principal.
// If the Dodo product remains SaaS + Tax Inclusive ON, Dodo will carve 18%
// off the ₹500 before it reaches us and treasury will be short ~₹76 per
// top-up. Verify Dodo tax category before mainnet flip.
//
// Target net margin: ~3.5% after Dodo fees. Knob is SERVICE_FEE_BPS.

import { convertInrToUsdg } from "@/lib/rates";

const BPS_DENOM = 10_000n;

// Service fee — flat percentage of top-up, inclusive of 18% GST. Covers
// Obscura platform margin + Dodo processing + govt GST on our cut.
// Net margin after all three: ~3.5%.
const SERVICE_FEE_BPS = 625n;

// Rate spread — quoted rate = marketRate × (1 + RATE_SPREAD_BPS / DENOM).
// Sized to cover exchange (~CoinDCX/Mudrex) spread on INR→USDC refills; no
// margin earned from the rate, only cost recovery.
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

// Wire-format version (bigint → string) for JSON-safe transport.
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

// Constants exported for UI (fee %, spread %) so labels render from a single
// source of truth.
export const SERVICE_FEE_PERCENT =
  Number(SERVICE_FEE_BPS) / Number(BPS_DENOM) * 100;
export const RATE_SPREAD_PERCENT =
  Number(RATE_SPREAD_BPS) / Number(BPS_DENOM) * 100;
