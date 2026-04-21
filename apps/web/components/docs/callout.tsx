type CalloutProps = {
  kind?: "info" | "warn" | "tip";
  title?: string;
  children: React.ReactNode;
};

const STYLES = {
  info: {
    border: "border-sky-800/50 bg-sky-950/20",
    dot: "bg-sky-400",
    label: "text-sky-300",
  },
  warn: {
    border: "border-amber-800/50 bg-amber-950/20",
    dot: "bg-amber-400",
    label: "text-amber-300",
  },
  tip: {
    border: "border-emerald-800/50 bg-emerald-950/10",
    dot: "bg-emerald-400",
    label: "text-emerald-300",
  },
} as const;

export function Callout({ kind = "info", title, children }: CalloutProps) {
  const styles = STYLES[kind];
  return (
    <aside
      className={`my-6 rounded-lg border px-5 py-4 ${styles.border}`}
      role="note"
    >
      <div
        className={`mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] ${styles.label}`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
        {title ?? kind}
      </div>
      <div className="text-[14px] leading-[1.7] text-zinc-300">{children}</div>
    </aside>
  );
}
