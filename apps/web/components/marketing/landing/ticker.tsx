const txns = [
  { agent: "AGT_A1F2", host: "news-api.com", amt: "0.008", ms: "412" },
  { agent: "AGT_F3B8", host: "weather.io/v2", amt: "0.012", ms: "385" },
  { agent: "AGT_C9D1", host: "serpapi.com", amt: "0.024", ms: "521" },
  { agent: "AGT_7E22", host: "scraper.run", amt: "0.006", ms: "287" },
  { agent: "AGT_B8A4", host: "openrouter.ai", amt: "0.095", ms: "640" },
  { agent: "AGT_4F1C", host: "maps-api.co", amt: "0.018", ms: "398" },
  { agent: "AGT_D2E7", host: "pdf-to-text", amt: "0.033", ms: "472" },
  { agent: "AGT_9A0B", host: "exa.ai/search", amt: "0.042", ms: "511" },
  { agent: "AGT_5C3D", host: "firecrawl.dev", amt: "0.027", ms: "333" },
  { agent: "AGT_E6F8", host: "replicate.com", amt: "0.150", ms: "890" },
];

export function Ticker() {
  const double = [...txns, ...txns];
  return (
    <div
      aria-label="Recent settlements ticker"
      className="relative overflow-hidden border-y border-zinc-800/60 bg-[#08080a] py-3"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#08080a] to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#08080a] to-transparent"
      />

      <div className="ticker-track flex w-max gap-10 font-mono text-[11px] text-zinc-500">
        {double.map((t, i) => (
          <div key={i} className="flex shrink-0 items-center gap-3">
            <span className="text-zinc-600">{t.agent}</span>
            <span className="text-zinc-700">→</span>
            <span className="text-zinc-300">{t.host}</span>
            <span className="text-emerald-400">{t.amt} USDC</span>
            <span className="text-zinc-600">{t.ms}ms</span>
            <span className="text-emerald-400">✓</span>
          </div>
        ))}
      </div>
    </div>
  );
}
