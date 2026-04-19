/**
 * Hero-side "call ledger" — a receipt for a single agent API call.
 * Lines fade in in sequence so the card feels alive without needing JS.
 */

const entries = [
  { label: "request", value: "fetch('news-api.com/v1/top')" },
  { label: "status", value: "402 Payment Required" },
  { label: "quote", value: "0.0080 USDC" },
  { label: "budget", value: "₹4.20 of ₹850 this month" },
  { label: "signer", value: "Privy · wallet_a1f2…c8d3" },
  { label: "broadcast", value: "Helius · devnet" },
  { label: "settle", value: "sig 5k2…f8a" },
  { label: "response", value: "200 OK · 412 bytes" },
];

export function ReceiptCard() {
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
        <span className="text-zinc-500">Call Ledger</span>
      </div>

      <div className="mt-4 space-y-2">
        {entries.map((e, i) => (
          <div
            key={e.label}
            className="reveal flex items-start gap-3"
            style={{ animationDelay: `${0.25 + i * 0.14}s` }}
          >
            <span className="w-[72px] shrink-0 text-zinc-600">{e.label}</span>
            <span className="text-zinc-200">{e.value}</span>
          </div>
        ))}
      </div>

      <div
        className="reveal mt-5 flex items-center justify-between border-t border-zinc-800 pt-4"
        style={{ animationDelay: `${0.25 + entries.length * 0.14}s` }}
      >
        <div className="flex items-center gap-2 text-emerald-400">
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M3 8.5l3 3 7-7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="text-[11px] uppercase tracking-[0.2em]">
            Settled
          </span>
        </div>
        <span className="text-[11px] text-zinc-500">
          0.0080 USDC · 412 ms
        </span>
      </div>
    </div>
  );
}
