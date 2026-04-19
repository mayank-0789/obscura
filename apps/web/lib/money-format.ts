// Formatters for money amounts that cross the wire as bigint strings.
//
// Base units:
//   - INR paise (100 paise = ₹1)
//   - USDG micros (1_000_000 micros = $1; 6 decimals)
//
// Everything goes through these helpers so rounding, locale, and unit math
// live in one place.

export function formatInr(paise: string | bigint): string {
  const rupees = toBigInt(paise) / 100n;
  return rupees.toLocaleString("en-IN");
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
