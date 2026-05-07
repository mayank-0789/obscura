/**
 * Sparkline — tiny SVG line chart, zero deps. The base data primitive of the
 * Tufte/Swiss-grid system: every numeric stat that has a series gets one of
 * these to its right. Stroke is 1px hairline; an optional area fill at low
 * alpha gives the line some weight without dominating.
 */
type Props = {
  values: readonly number[];
  width?: number;
  height?: number;
  /** Render in signal-red (state changes, alerts). Default: foreground. */
  accent?: boolean;
  /** Fill under the line at low alpha. Default: false. */
  area?: boolean;
  /** Mark the latest point with a small dot. Default: false. */
  endDot?: boolean;
  className?: string;
};

const ACCENT = "#e63946";
const FG = "#f5f5f5";

export function Sparkline({
  values,
  width = 96,
  height = 24,
  accent = false,
  area = false,
  endDot = false,
  className,
}: Props) {
  if (values.length < 2) {
    return (
      <svg width={width} height={height} className={className} aria-hidden />
    );
  }

  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);

  const stroke = accent ? ACCENT : FG;
  const fill = accent ? "rgba(230,57,70,0.10)" : "rgba(245,245,245,0.06)";

  const points = values
    .map((v, i) => `${i * step},${height - ((v - min) / range) * height}`)
    .join(" ");
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  const lastY = height - (((values.at(-1) ?? 0) - min) / range) * height;

  return (
    <svg
      width={width}
      height={height}
      className={`inline-block align-middle ${className ?? ""}`}
    >
      {area ? <polygon points={areaPoints} fill={fill} /> : null}
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      {endDot ? <circle cx={width} cy={lastY} r={1.6} fill={stroke} /> : null}
    </svg>
  );
}
