/**
 * SectionMarker — the index/rule/label triplet that opens every Swiss-grid
 * section. The numbered index ("00", "01", …) is signal-red; the rule is a
 * short hairline in foreground; the label is muted mono-uppercase.
 *
 *   00 ─── label
 */
export function SectionMarker({
  index,
  label,
}: {
  index: string;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em]">
      <span style={{ color: "#e63946" }}>{index}</span>
      <span
        aria-hidden
        className="inline-block h-px w-8"
        style={{ backgroundColor: "#f5f5f5" }}
      />
      <span style={{ color: "#888" }}>{label}</span>
    </div>
  );
}

/**
 * Hairline — a thin rule with optional inline label.
 *
 *   ────────────────  or  ─── LABEL ────────────────
 */
export function Hairline({
  label,
  strong = false,
  className = "",
}: {
  label?: string;
  /** Foreground (1px) instead of subtle (#1f1f1f). */
  strong?: boolean;
  className?: string;
}) {
  const color = strong ? "#f5f5f5" : "#1f1f1f";

  if (!label) {
    return (
      <div
        className={className}
        style={{ height: 1, backgroundColor: color }}
      />
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span
        aria-hidden
        className="inline-block h-px w-8"
        style={{ backgroundColor: color }}
      />
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
        {label}
      </span>
      <span
        aria-hidden
        className="inline-block h-px flex-1"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}
