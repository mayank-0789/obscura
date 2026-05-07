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
    <aside className="flex h-[calc(100vh-3rem)] w-[280px] max-w-[85vw] shrink-0 flex-col border-r border-[#1f1f1f] bg-[#0a0a0a] md:h-auto">
      {/* Section header */}
      <div className="flex items-center justify-between border-b border-[#1f1f1f] px-5 py-4">
        <div className="flex items-baseline gap-2.5 font-mono text-[10px] uppercase tracking-[0.22em]">
          <span style={{ color: "#e63946" }}>00</span>
          <span className="inline-block h-px w-5 bg-[#f5f5f5]" />
          <span className="text-[#888]">agents</span>
          {count > 0 && (
            <span className="tabular-nums text-[#5a5a5a]">({count})</span>
          )}
        </div>
        <button
          type="button"
          onClick={onNewAgent}
          className="group flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#888] transition hover:text-[#f5f5f5]"
          title="new agent"
        >
          <span aria-hidden>+</span>
          <Kbd>⌘N</Kbd>
        </button>
      </div>

      {/* Agent list */}
      <nav className="flex-1 overflow-y-auto py-2">
        {agents === undefined ? (
          <SidebarSkeleton />
        ) : agents.length === 0 ? (
          <EmptySidebarHint onNewAgent={onNewAgent} />
        ) : (
          <ul>
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
      <div className="border-t border-[#1f1f1f] px-5 py-4">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#5a5a5a]">
          your wallet
        </div>
        {walletAddress ? (
          <>
            <div
              className="mt-2 truncate font-mono text-[12px] text-[#f5f5f5]"
              title={walletAddress}
            >
              {shortPk(walletAddress)}
            </div>
            <a
              href={`https://solscan.io/account/${walletAddress}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#888] transition hover:text-[#e63946]"
            >
              solscan
              <span aria-hidden>↗</span>
            </a>
          </>
        ) : (
          <div className="mt-2 font-mono text-[11px] text-[#888]">
            provisioning…
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

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative block w-full px-5 py-3 text-left transition ${
        selected ? "bg-[#141414]" : "hover:bg-[#0e0e0e]"
      }`}
    >
      {selected && (
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 h-full w-px"
          style={{ backgroundColor: "#e63946" }}
        />
      )}
      <div className="flex items-baseline gap-2.5">
        <span
          aria-hidden="true"
          className="font-mono text-[10px]"
          style={{ color: selected ? "#e63946" : "#5a5a5a" }}
        >
          {selected ? "◉" : "○"}
        </span>
        <span
          className={`flex-1 truncate text-[13px] tracking-[-0.005em] ${
            selected ? "text-[#f5f5f5]" : "text-[#aaa]"
          }`}
        >
          {agent.name}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-[#888]">
          {balance ? `$${formatUsdg(balance.amount)}` : "—"}
        </span>
      </div>

      {budget && (
        <div className="mt-2.5 flex items-center gap-2 pl-5">
          <div className="relative h-px flex-1 bg-[#1f1f1f]">
            <div
              className="absolute left-0 top-0 h-full"
              style={{
                width: `${percent.toFixed(1)}%`,
                backgroundColor: percent > 85 ? "#e63946" : "#888",
              }}
            />
          </div>
          <span className="font-mono text-[10px] tabular-nums text-[#5a5a5a]">
            {percent.toFixed(0)}%
          </span>
        </div>
      )}
    </button>
  );
}

function SidebarSkeleton() {
  return (
    <div className="space-y-px px-5 py-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-12 animate-pulse bg-[#0e0e0e]" />
      ))}
    </div>
  );
}

function EmptySidebarHint({ onNewAgent }: { onNewAgent: () => void }) {
  return (
    <div className="px-5 py-8">
      <p className="text-[12px] leading-[1.6] text-[#888]">
        No agents yet. Create your first one to get started.
      </p>
      <button
        type="button"
        onClick={onNewAgent}
        className="mt-5 inline-flex items-center gap-3 border border-[#1f1f1f] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#f5f5f5] transition hover:border-[#333]"
      >
        <span aria-hidden>+</span>
        new agent
        <Kbd>⌘N</Kbd>
      </button>
    </div>
  );
}

function shortPk(pk: string) {
  if (pk.length <= 12) return pk;
  return `${pk.slice(0, 6)}…${pk.slice(-4)}`;
}
