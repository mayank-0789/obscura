"use client";

type RoleCardProps = {
  kicker: string;
  title: string;
  body: string;
  features: string[];
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
};

export function RoleCard({
  kicker,
  title,
  body,
  features,
  onClick,
  isLoading = false,
  disabled = false,
}: RoleCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className="group relative flex h-full flex-col gap-5 border border-zinc-800 bg-[#0c0c0e] p-7 text-left transition enabled:hover:border-emerald-400/40 enabled:hover:bg-[#0e1311] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
    >
      {/* Zinc kicker on cards so the emerald "Welcome" kicker at the top of
          the page stays the single emerald anchor — three emerald kickers
          stacked would dilute the signal. */}
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-zinc-500">
        {kicker}
      </p>

      <h2 className="font-display text-[26px] font-light leading-[1.15] tracking-[-0.01em] text-zinc-50">
        {title}
      </h2>

      <p className="text-[14px] leading-[1.65] text-zinc-400">{body}</p>

      <ul className="space-y-2 pt-1 text-[13px] leading-[1.5] text-zinc-400">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2.5">
            <span
              aria-hidden
              className="mt-[9px] inline-block h-px w-3 shrink-0 bg-emerald-400/70"
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center gap-2 pt-4 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500 transition group-enabled:group-hover:text-emerald-400">
        <span>{isLoading ? "Setting up…" : "Choose this path"}</span>
        <span
          aria-hidden
          className="transition-transform group-enabled:group-hover:translate-x-1"
        >
          →
        </span>
      </div>
    </button>
  );
}
