// Display ticker for whatever STABLECOIN_MINT currently points at.
export const STABLECOIN_TICKER = "USDC";

export function formatInr(paise: string | bigint): string {
  const rupees = toBigInt(paise) / 100n;
  return rupees.toLocaleString("en-IN");
}

export function formatInrExact(paise: string | bigint): string {
  const amount = Number(toBigInt(paise)) / 100;
  return amount.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatUsdg(micros: string | bigint): string {
  const amount = Number(toBigInt(micros)) / 1_000_000;
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toBigInt(v: string | bigint): bigint {
  return typeof v === "bigint" ? v : BigInt(v);
}
