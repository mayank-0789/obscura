// Money conversion — pure math only. No I/O, no server-only imports.
// Safe to import from client components.
//
// Live-rate fetch + fallback wrapper live in lib/fx.ts (server-only).

// Client-safe so the top-up hook can render a sensible UI before the live
// rate arrives. `lib/fx.ts` re-exports this for server callers.
export const FX_FALLBACK_INR_PER_USD = 85;

/**
 * Pure converter: INR (paise) → USDG (micros) at a given rate.
 *
 * Math: paise / 100 = INR; INR / rate = USD; USD × 1_000_000 = micros.
 * Combined: `micros = paise × 10_000 / rate`. Scale `rate` by 1_000_000 so
 * we stay in integer math: `micros = paise × 1e10 / rateScaled`.
 */
export function convertInrToUsdg(paise: bigint, rate: number): bigint {
  const rateScaled = BigInt(Math.round(rate * 1_000_000));
  return (paise * 10_000_000_000n) / rateScaled;
}
