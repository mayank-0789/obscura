"use client";

import { useAppShell } from "./app-shell";
import { Kbd } from "./kbd";

export function EmptyDetailPanel({ hasAgents }: { hasAgents: boolean }) {
  const { openCreateModal } = useAppShell();

  if (!hasAgents) {
    return (
      <div className="flex min-h-full items-center justify-center px-8 py-12">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-xl border border-zinc-800 bg-zinc-950">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 text-emerald-400"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h2 className="text-[22px] font-semibold tracking-[-0.01em] text-zinc-50">
            Create your first agent
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-[14px] leading-[1.55] text-zinc-400">
            We&apos;ll provision a dedicated Solana wallet, an API key, and a
            monthly spend cap. You fund it in rupees — your agent spends it
            on-chain.
          </p>
          <button
            type="button"
            onClick={openCreateModal}
            className="mt-7 inline-flex items-center gap-2 rounded-md bg-emerald-400 px-4 py-2.5 text-[13px] font-semibold text-black transition hover:bg-emerald-300"
          >
            <span>+ New agent</span>
            <Kbd>⌘N</Kbd>
          </button>
          <p className="mt-5 text-[11px] text-zinc-600">
            Takes about thirty seconds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full items-center justify-center px-8 py-12">
      <div className="max-w-sm text-center">
        <p className="text-[13px] text-zinc-500">Select an agent</p>
        <p className="mt-2 text-[12px] text-zinc-600">
          Use <Kbd>J</Kbd> <Kbd>K</Kbd> to navigate · <Kbd>⌘N</Kbd> to create
          · <Kbd>⌘K</Kbd> to search
        </p>
      </div>
    </div>
  );
}
