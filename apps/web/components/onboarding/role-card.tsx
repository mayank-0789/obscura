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
  const active = isLoading;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={`group relative flex h-full flex-col gap-4 border border-[#1f1f1f] p-5 text-left transition focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 sm:gap-5 sm:p-7 ${
        active ? "bg-[#141414]" : "enabled:hover:bg-[#0e0e0e]"
      }`}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 h-full w-px"
          style={{ backgroundColor: "#e63946" }}
        />
      )}

      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
        {kicker}
      </p>

      <h2
        style={{
          fontSize: "clamp(20px, 4vw, 24px)",
          fontWeight: 500,
          letterSpacing: "-0.015em",
          lineHeight: 1.2,
          color: "#f5f5f5",
        }}
      >
        {title}
      </h2>

      <p className="text-[14px] leading-[1.65] text-[#888]">{body}</p>

      <ul className="space-y-2.5 pt-1 text-[13px] leading-[1.55] text-[#888]">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-[10px] inline-block h-px w-3 shrink-0"
              style={{ backgroundColor: "#f5f5f5" }}
            />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div
        className="mt-auto flex items-center gap-2 pt-4 font-mono text-[10px] uppercase tracking-[0.22em] transition"
        style={{ color: active ? "#e63946" : "#888" }}
      >
        <span>{isLoading ? "setting up…" : "choose this path"}</span>
        <span aria-hidden>→</span>
      </div>
    </button>
  );
}
