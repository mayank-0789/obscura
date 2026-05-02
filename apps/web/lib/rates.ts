export const FX_FALLBACK_INR_PER_USD = 85;

/** Pure converter: INR (paise) → USDG (micros). Scales `rate` by 1e6 to stay in integer math. */
export function convertInrToUsdg(paise: bigint, rate: number): bigint {
  const rateScaled = BigInt(Math.round(rate * 1_000_000));
  return (paise * 10_000_000_000n) / rateScaled;
}
