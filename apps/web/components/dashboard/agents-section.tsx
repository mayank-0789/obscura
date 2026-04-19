"use client";

import { useState } from "react";
import Link from "next/link";
import { solscanAccountUrl } from "@/lib/solscan";
import { formatInr } from "@/lib/money-format";
import { useAgents } from "@/hooks/use-agents";
import type { CreateAgentResult } from "@/hooks/use-create-agent";
import type { AgentDTO } from "@/types/agent";
import { AgentsEmptyState } from "./agents-empty-state";
import { CreateAgentModal } from "./create-agent-modal";
import { RevealApiKeyCard } from "./reveal-api-key-card";

// Orchestrates the agents area of the dashboard: list + create modal + the
// one-time API key reveal. All agent-related state is scoped here so the
// parent dashboard stays thin.
export function AgentsSection() {
  const { data: agents, isLoading, error } = useAgents();
  const [modalOpen, setModalOpen] = useState(false);
  const [justCreated, setJustCreated] = useState<CreateAgentResult | null>(null);

  const handleCreated = (result: CreateAgentResult) => {
    setModalOpen(false);
    setJustCreated(result);
  };

  return (
    <section className="space-y-4">
      <header className="flex items-end justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">
            Agents
          </p>
          <h2 className="mt-1 text-xl font-semibold text-zinc-100">
            Your agents
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-black transition hover:bg-emerald-400"
        >
          + New agent
        </button>
      </header>

      {justCreated && (
        <RevealApiKeyCard
          agentName={justCreated.agent.name}
          apiKey={justCreated.apiKey}
          onDismiss={() => setJustCreated(null)}
        />
      )}

      {isLoading ? (
        <AgentsLoadingSkeleton />
      ) : error ? (
        <p className="text-sm text-zinc-400">
          Couldn&apos;t load your agents. Refresh to try again.
        </p>
      ) : !agents || agents.length === 0 ? (
        <AgentsEmptyState />
      ) : (
        <AgentsList agents={agents} />
      )}

      <CreateAgentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleCreated}
      />
    </section>
  );
}

function AgentsList({ agents }: { agents: AgentDTO[] }) {
  return (
    <ul className="space-y-2">
      {agents.map((agent) => (
        <AgentRow key={agent.id} agent={agent} />
      ))}
    </ul>
  );
}

function AgentRow({ agent }: { agent: AgentDTO }) {
  const solscanUrl = solscanAccountUrl(agent.publicKey);

  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 transition hover:border-zinc-700">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href={`/agents/${agent.id}`}
            className="block text-sm font-medium text-zinc-100 transition hover:text-emerald-400"
          >
            {agent.name}
          </Link>
          <div className="mt-1 truncate font-mono text-xs text-zinc-500">
            {agent.publicKey}
          </div>
        </div>

        <div className="flex items-center gap-4 text-right">
          {agent.budget && (
            <div className="text-xs text-zinc-400">
              <div className="font-mono text-sm text-zinc-100">
                ₹{formatInr(agent.budget.capInr)}
              </div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                {agent.budget.period} cap
              </div>
            </div>
          )}
          <StatusBadge status={agent.status} />
          <a
            href={solscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-500 transition hover:text-emerald-400"
          >
            Solscan →
          </a>
        </div>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: AgentDTO["status"] }) {
  const styles: Record<AgentDTO["status"], string> = {
    active: "border-emerald-800/50 bg-emerald-950/40 text-emerald-300",
    paused: "border-amber-800/50 bg-amber-950/40 text-amber-300",
    cancelled: "border-zinc-800 bg-zinc-950 text-zinc-500",
  };
  return (
    <span
      className={`rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${styles[status]}`}
    >
      {status}
    </span>
  );
}

function AgentsLoadingSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-lg border border-zinc-800 bg-zinc-950/40"
        />
      ))}
    </div>
  );
}
