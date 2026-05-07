import { Sparkline } from "./sparkline";

/**
 * StatCell — Tufte stat block. Number + sparkline + label + optional source.
 * Used in any data section where a single number could otherwise sit alone
 * (dashboards, market figures, merchant strip). Hairline borders are
 * applied by the parent grid, not the cell itself, so cells share edges.
 */
type Props = {
  /** The headline figure. Pre-formatted; tabular-nums applied here. */
  value: string;
  /** Short index/id (e.g. "fig. 1.2"). Optional. */
  index?: string;
  /** What the figure represents (one short line). */
  label: string;
  /** Citation/source line (italic-mono treatment). Optional. */
  source?: string;
  /** Series for the sparkline. Optional — omit for no chart. */
  spark?: readonly number[];
  /** Render the sparkline in signal-red. */
  accent?: boolean;
  /** Tighter type for compact dashboards. */
  compact?: boolean;
};

export function StatCell({
  value,
  index,
  label,
  source,
  spark,
  accent = false,
  compact = false,
}: Props) {
  const valueSize = compact ? 28 : 44;
  const labelSize = compact ? 12 : 12.5;

  return (
    <div className="px-5 py-6">
      {index ? (
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
          {index}
        </div>
      ) : null}

      <div
        className="mt-3 tabular-nums text-[#f5f5f5]"
        style={{
          fontSize: valueSize,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>

      {spark ? (
        <div className="mt-4">
          <Sparkline values={spark} width={120} height={26} accent={accent} />
        </div>
      ) : null}

      <p
        className="mt-4 leading-[1.55] text-[#f5f5f5]"
        style={{ fontSize: labelSize }}
      >
        {label}
      </p>
      {source ? (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#888]">
          {source}
        </p>
      ) : null}
    </div>
  );
}
