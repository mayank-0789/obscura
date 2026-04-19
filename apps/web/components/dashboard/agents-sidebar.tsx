"use client";

import { useAgentBalance } from "@/hooks/use-agent-balance";
import { formatUsdg } from "@/lib/money-format";
import type { AgentDTO } from "@/types/agent";
import { Kbd } from "./kbd";

type Props = {
  agents: AgentDTO[] | undefined;
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  onNewAgent: () => void;
  walletAddress: string | null;
};

export function AgentsSidebar({
  agents,
  selectedId,
  onSelect,
  onNewAgent,
  walletAddress,
}: Props) {
  const count = agents?.length ?? 0;

  return (
    <aside className="flex w-[300px] shrink-0 flex-col border-r border-zinc-800/80 bg-[#08080a]">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
            Agents
          </span>
          {count > 0 && (
            <span className="rounded-full bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
              {count}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onNewAgent}
          className="group flex h-6 items-center gap-1.5 rounded-md px-1.5 text-[11px] text-zinc-500 transition hover:bg-zinc-900 hover:text-zinc-200"
          title="New agent"
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
            <path
              d="M6 2 L6 10 M2 6 L10 6"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <Kbd>⌘N</Kbd>
        </button>
      </div>

      {/* Agent list */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {agents === undefined ? (
          <SidebarSkeleton />
        ) : agents.length === 0 ? (
          <EmptySidebarHint onNewAgent={onNewAgent} />
        ) : (
          <ul className="space-y-0.5">
            {agents.map((agent) => (
              <li key={agent.id}>
                <AgentRow
                  agent={agent}
                  selected={agent.id === selectedId}
                  onSelect={() => onSelect(agent.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </nav>

      {/* Wallet */}
      <div className="border-t border-zinc-800/80 px-4 py-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
          Your wallet
        </div>
        {walletAddress ? (
          <>
            <div
              className="mt-1.5 truncate font-mono text-[12px] text-zinc-300"
              title={walletAddress}
            >
              {shortPk(walletAddress)}
            </div>
            <a
              href={`https://solscan.io/account/${walletAddress}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-zinc-500 transition hover:text-emerald-400"
            >
              View on Solscan
              <span aria-hidden="true" className="text-zinc-600">↗</span>
            </a>
          </>
        ) : (
          <div className="mt-1.5 text-[12px] text-amber-400">
            Provisioning…
          </div>
        )}
      </div>
    </aside>
  );
}

function AgentRow({
  agent,
  selected,
  onSelect,
}: {
  agent: AgentDTO;
  selected: boolean;
  onSelect: () => void;
}) {
  const { data: balance } = useAgentBalance(agent.id);
  const budget = agent.budget;
  const percent =
    budget && BigInt(budget.capUsdg) > 0n
      ? Math.min(
          100,
          Number((BigInt(budget.spentUsdg) * 10000n) / BigInt(budget.capUsdg)) /
            100,
        )
      : 0;

  const dot =
    agent.status === "active"
      ? "bg-emerald-400"
      : agent.status === "paused"
        ? "bg-amber-400"
        : "bg-zinc-600";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative w-full rounded-md px-2.5 py-2 text-left transition ${
        selected
          ? "bg-zinc-900 ring-1 ring-zinc-800"
          : "hover:bg-zinc-900/60"
      }`}
    >
      {selected && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-emerald-400"
        />
      )}
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
        <span
          className={`flex-1 truncate text-[13px] font-medium ${
            selected ? "text-zinc-50" : "text-zinc-200"
          }`}
        >
          {agent.name}
        </span>
        <span className="font-mono text-[11px] text-zinc-500">
          {balance ? `$${formatUsdg(balance.amount)}` : "—"}
        </span>
      </div>

      {budget && (
        <div className="mt-2 flex items-center gap-2 pl-3.5">
          <div className="relative h-[2px] flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`absolute left-0 top-0 h-full ${
                percent > 85 ? "bg-amber-400" : "bg-emerald-400/70"
              }`}
              style={{ width: `${percent.toFixed(1)}%` }}
            />
          </div>
          <span className="font-mono text-[10px] text-zinc-500">
            {percent.toFixed(0)}%
          </span>
        </div>
      )}
    </button>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-1 px-0.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-11 animate-pulse rounded-md bg-zinc-900/60"
        />
      ))}
    </div>
  );
}

function EmptySidebarHint({ onNewAgent }: { onNewAgent: () => void }) {
  return (
    <div className="px-3 py-6 text-center">
      <p className="text-[12px] leading-[1.55] text-zinc-500">
        No agents yet. Create your first one to get started.
      </p>
      <button
        type="button"
        onClick={onNewAgent}
        className="mt-4 inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[12px] font-medium text-zinc-100 transition hover:border-zinc-700"
      >
        + New agent
        <Kbd>⌘N</Kbd>
      </button>
    </div>
  );
}

function shortPk(pk: string) {
  if (pk.length <= 12) return pk;
  return `${pk.slice(0, 6)}…${pk.slice(-4)}`;
}
