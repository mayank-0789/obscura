"use client";

import { useAppShell } from "./app-shell";
import { Kbd } from "./kbd";

export function EmptyDetailPanel({ hasAgents }: { hasAgents: boolean }) {
  const { openCreateModal } = useAppShell();

  if (!hasAgents) {
    return (
      <div className="flex min-h-full items-center justify-center px-8 py-12">
        <div className="max-w-md text-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
            <span style={{ color: "#e63946" }}>00</span>{" "}
            <span
              aria-hidden
              className="mx-2 inline-block h-px w-8 align-middle"
              style={{ backgroundColor: "#f5f5f5" }}
            />
            no agents yet
          </div>
          <h2
            className="mt-8 text-[28px] text-[#f5f5f5]"
            style={{ fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.05 }}
          >
            Create your first agent
          </h2>
          <p className="mx-auto mt-5 max-w-sm text-[14px] leading-[1.6] text-[#888]">
            We&apos;ll provision a dedicated Solana wallet, an API key, and a
            monthly spend cap. You fund it in rupees — your agent spends it
            on-chain.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-8 inline-flex items-center gap-2 border-b pb-1 font-mono text-[11px] uppercase tracking-[0.18em] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e63946]"
            style={{ borderColor: "#e63946", color: "#e63946" }}
          >
            <span>+ new agent</span>
            <Kbd>⌘N</Kbd>
          </button>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.22em] text-[#5a5a5a]">
            takes about thirty seconds
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center px-8 py-12">
      <div className="max-w-sm text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#888]">
          select an agent
        </p>
        <p className="mt-4 font-mono text-[11px] text-[#5a5a5a]">
          <Kbd>J</Kbd> <Kbd>K</Kbd> navigate · <Kbd>⌘N</Kbd> create ·{" "}
          <Kbd>⌘K</Kbd> search
        </p>
      </div>
    </div>
  );
}
