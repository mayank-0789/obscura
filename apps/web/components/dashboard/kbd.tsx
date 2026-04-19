export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[18px] items-center justify-center rounded border border-zinc-800 bg-zinc-950 px-1.5 py-px font-mono text-[10px] font-medium text-zinc-400 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.04)]">
      {children}
    </kbd>
  );
}
