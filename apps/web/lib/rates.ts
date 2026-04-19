// Money conversion helpers.
//
// All monetary values move around as bigints in base units:
//   - INR is measured in paise  (₹1 = 100 paise)
//   - USDG is measured in micros (1 USDG = 1_000_000 base units; 6 decimals)
//
// v1 uses a hardcoded FX rate — good enough for the hackathon demo. Swap this
// function for a live quote (Frankfurter / Pyth / Jupiter) by changing the
// single INR_PER_USD constant or replacing the body with a fetch.
// Every caller goes through `quoteInrToUsdg`, so the change is one file.

const INR_PER_USD = 85;

const USDG_PER_USD = 1_000_000n; // 6 decimals
const PAISE_PER_INR = 100n;

/**
 * Convert an INR amount (paise) to USDG base units at the current snapshot rate.
 * Rate is locked at call time and should be stored alongside the resulting USDG
 * amount (see `budgets.rate_snapshot` / `transactions.rate_snapshot`).
 */
export function quoteInrToUsdg(paise: bigint): {
  usdg: bigint;
  rate: number;
} {
  const rate = INR_PER_USD;
  const usdg = (paise * USDG_PER_USD) / (PAISE_PER_INR * BigInt(rate));
  return { usdg, rate };
}
