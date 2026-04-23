import "server-only";

import { convertInrToUsdg, FX_FALLBACK_INR_PER_USD } from "@/lib/rates";

export { FX_FALLBACK_INR_PER_USD };

// Live INR/USD rate sourced from Frankfurter (https://frankfurter.app) — ECB
// reference rates, free, no API key. Cached in-process for 15 minutes so we
// don't hammer the endpoint on every checkout.
//
// When Frankfurter is unreachable or returns implausible data, callers fall
// back to a hardcoded rate so checkout stays alive. Stale-by-a-day is fine;
// INR/USD doesn't swing meaningfully hour-to-hour.

const CACHE_TTL_MS = 15 * 60 * 1000;
const FETCH_TIMEOUT_MS = 3_000;
const FRANKFURTER_URL = "https://api.frankfurter.app/latest?from=USD&to=INR";

type CacheEntry = { rate: number; fetchedAt: number };
let cache: CacheEntry | null = null;

export type FxQuote = {
  rate: number;
  source: "live" | "cached" | "fallback";
  fetchedAt: number;
};

/**
 * Fetch the live rate and convert INR paise to USDG micros. Rate is locked at
 * call time and should be stored alongside the resulting USDG amount
 * (see `transactions.rate_snapshot`).
 */
export async function quoteInrToUsdg(paise: bigint): Promise<{
  usdg: bigint;
  rate: number;
}> {
  const { rate } = await getInrPerUsd();
  return { usdg: convertInrToUsdg(paise, rate), rate };
}

export async function getInrPerUsd(): Promise<FxQuote> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { rate: cache.rate, source: "cached", fetchedAt: cache.fetchedAt };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const res = await fetch(FRANKFURTER_URL, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`frankfurter http ${res.status}`);
    const body = (await res.json()) as { rates?: { INR?: number } };
    const rate = body.rates?.INR;

    // Plausibility guard. INR/USD has been in [60, 110] for a decade; anything
    // outside that is almost certainly a bad payload.
    if (typeof rate !== "number" || rate < 50 || rate > 150) {
      throw new Error(`frankfurter: implausible rate ${rate}`);
    }

    cache = { rate, fetchedAt: now };
    return { rate, source: "live", fetchedAt: now };
  } catch (err) {
    console.warn("[fx] live rate failed, using fallback:", err);
    return {
      rate: FX_FALLBACK_INR_PER_USD,
      source: "fallback",
      fetchedAt: now,
    };
  }
}
