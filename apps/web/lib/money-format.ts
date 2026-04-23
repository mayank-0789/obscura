// Formatters for money amounts that cross the wire as bigint strings.
//
// Base units:
//   - INR paise (100 paise = ₹1)
//   - Stablecoin micros (1_000_000 micros = $1; 6 decimals for both USDC and USDG)
//
// Everything goes through these helpers so rounding, locale, and unit math
// live in one place.

// Display ticker for whatever STABLECOIN_MINT currently points at. Update
// alongside the mint when swapping USDC ↔ USDG. The function name
// `formatUsdg` is a historical artifact — it formats 6-decimal micros
// regardless of brand.
export const STABLECOIN_TICKER = "USDC";

export function formatInr(paise: string | bigint): string {
  const rupees = toBigInt(paise) / 100n;
  return rupees.toLocaleString("en-IN");
}

// Breakdown lines need sub-rupee precision (GST lands on 76.27, fees on
// decimals). Capped at 9 quadrillion paise which is more than big enough.
export function formatInrExact(paise: string | bigint): string {
  const amount = Number(toBigInt(paise)) / 100;
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatUsdg(micros: string | bigint): string {
  // Safe for our cap ceilings — max $11,700 worth; well inside Number range.
  const amount = Number(toBigInt(micros)) / 1_000_000;
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toBigInt(v: string | bigint): bigint {
  return typeof v === "bigint" ? v : BigInt(v);
}
