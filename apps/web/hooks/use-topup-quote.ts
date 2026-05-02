"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthedFetch } from "@/hooks/use-authed-fetch";
import {
  calculateTopupBreakdown,
  type TopupBreakdown,
  type TopupBreakdownDTO,
} from "@/lib/pricing";
import { FX_FALLBACK_INR_PER_USD } from "@/lib/rates";

type RateSource = "live" | "cached" | "fallback";

type QuoteResponse = {
  breakdown: TopupBreakdownDTO;
  rateSource: RateSource;
  fetchedAt: number;
};

// Fetches rate once + recomputes locally; null breakdown below ₹500 or while loading.
export function useTopupQuote(amountInr: number | ""): {
  breakdown: TopupBreakdown | null;
  rate: number | null;
  rateSource: RateSource;
  loading: boolean;
} {
  const authedFetch = useAuthedFetch();
  const [rate, setRate] = useState<number | null>(null);
  const [rateSource, setRateSource] = useState<RateSource>("fallback");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchRate = async () => {
      try {
        const res = await authedFetch("/api/topup/quote", {
          method: "POST",
          body: JSON.stringify({ amountInr: 500 }),
        });
        if (!res.ok) throw new Error(`quote: http ${res.status}`);
        const json = (await res.json()) as QuoteResponse;
        if (cancelled) return;
        setRate(json.breakdown.marketRate);
        setRateSource(json.rateSource);
      } catch {
        if (cancelled) return;
        setRate(FX_FALLBACK_INR_PER_USD);
        setRateSource("fallback");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void fetchRate();
    // 90s refresh closes the breakdown-vs-server-lock divergence window.
    const interval = setInterval(fetchRate, 90_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [authedFetch]);

  const breakdown = useMemo<TopupBreakdown | null>(() => {
    if (typeof rate !== "number" || !Number.isFinite(rate)) return null;
    if (typeof amountInr !== "number" || amountInr < 500) return null;
    return calculateTopupBreakdown(BigInt(amountInr) * 100n, rate);
  }, [amountInr, rate]);

  return { breakdown, rate, rateSource, loading };
}
