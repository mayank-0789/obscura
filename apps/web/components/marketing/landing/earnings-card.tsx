const recent = [
  { time: "23:14", path: "/article/8421", amt: "0.02" },
  { time: "23:14", path: "/article/2057", amt: "0.02" },
  { time: "23:14", path: "/search?q=ai", amt: "0.01" },
  { time: "23:13", path: "/article/0893", amt: "0.02" },
  { time: "23:13", path: "/trending", amt: "0.005" },
  { time: "23:13", path: "/article/5561", amt: "0.02" },
];

export function EarningsCard() {
  return (
    <div className="relative border border-zinc-800 bg-[#0c0c0e] p-5 font-mono text-[12px] leading-[1.65] text-zinc-300 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px border border-emerald-500/10"
      />

      <div className="flex items-center justify-between border-b border-zinc-800 pb-3 text-[10px] uppercase tracking-[0.26em]">
        <span className="flex items-center gap-2 text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Live
        </span>
        <span className="text-zinc-500">Earnings</span>
      </div>

      <div className="reveal mt-5" style={{ animationDelay: "0.2s" }}>
        <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-600">
          Today
        </div>
        <div className="mt-1.5 flex items-baseline gap-3">
          <span className="font-display text-[44px] font-light leading-none tracking-[-0.02em] text-emerald-gradient">
            $4.78
          </span>
          <span className="text-[11px] text-zinc-500">USDC · 239 calls</span>
        </div>
      </div>

      <div className="mt-6 border-t border-zinc-800 pt-4">
        <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-zinc-600">
          Recent
        </div>
        <div className="space-y-1.5">
          {recent.map((r, i) => (
            <div
              key={i}
              className="reveal flex items-center gap-3 text-[11.5px]"
              style={{ animationDelay: `${0.35 + i * 0.12}s` }}
            >
              <span className="w-10 shrink-0 text-zinc-600">{r.time}</span>
              <span className="flex-1 truncate text-zinc-300">{r.path}</span>
              <span className="text-emerald-400">+{r.amt}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        className="reveal mt-5 flex items-center justify-between border-t border-zinc-800 pt-4"
        style={{ animationDelay: `${0.35 + recent.length * 0.12}s` }}
      >
        <div className="flex items-center gap-2 text-emerald-400">
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M3 8 L13 8 M9 4 L13 8 L9 12"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[11px] uppercase tracking-[0.2em]">
            Cash out
          </span>
        </div>
        <span className="text-[11px] text-zinc-500">
          $47.93 → bank (Dodo)
        </span>
      </div>
    </div>
  );
}
