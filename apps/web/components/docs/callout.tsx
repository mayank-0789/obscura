type CalloutProps = {
  kind?: "info" | "warn" | "tip";
  title?: string;
  children: React.ReactNode;
};

const STYLES = {
  info: { dot: "#f5f5f5", label: "#f5f5f5" },
  warn: { dot: "#e63946", label: "#e63946" },
  tip: { dot: "#f5f5f5", label: "#f5f5f5" },
} as const;

export function Callout({ kind = "info", title, children }: CalloutProps) {
  const styles = STYLES[kind];
  return (
    <aside
      className="my-6 border border-[#1f1f1f] px-5 py-4"
      style={{ borderLeftColor: styles.dot, borderLeftWidth: 1 }}
      role="note"
    >
      <div
        className="mb-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em]"
        style={{ color: styles.label }}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: styles.dot }}
        />
        {title ?? kind}
      </div>
      <div className="text-[14px] leading-[1.7] text-[#888]">{children}</div>
    </aside>
  );
}
