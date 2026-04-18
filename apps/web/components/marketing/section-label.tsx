export function SectionLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">
      {children}
    </div>
  );
}
