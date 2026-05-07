export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[18px] items-center justify-center border border-[#1f1f1f] bg-[#0a0a0a] px-1.5 py-px font-mono text-[10px] font-medium text-[#888]">
      {children}
    </kbd>
  );
}
