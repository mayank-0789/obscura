"use client";

import Link from "next/link";
import { solscanAccountUrl } from "@/lib/solscan";
import {
  formatInr,
  formatUsdg,
  STABLECOIN_TICKER,
} from "@/lib/money-format";
import type { AgentDTO } from "@/types/agent";
import { Kbd } from "./kbd";

export function AgentDetailPanel({ agent }: { agent: AgentDTO }) {
  const solscanUrl = solscanAccountUrl(agent.publicKey);
  const isActive = agent.status === "active";

  const budget = agent.budget;
  const remaining = budget
    ? (BigInt(budget.capUsdg) - BigInt(budget.spentUsdg)).toString()
    : null;
  const percent =
    budget && BigInt(budget.capUsdg) > 0n
      ? Math.min(
          100,
          Number((BigInt(budget.spentUsdg) * 10000n) / BigInt(budget.capUsdg)) /
            100,
        )
      : 0;

  return (
    <div className="px-8 py-10 lg:px-12">
      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-6 border-b border-zinc-800 pb-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusPill status={agent.status} />
            <span className="font-mono text-[11px] text-zinc-600">·</span>
            <span className="font-mono text-[11px] text-zinc-500">
              Created {formatDate(agent.createdAt)}
            </span>
          </div>
          <h1 className="mt-3 text-[28px] font-semibold tracking-[-0.01em] text-zinc-50">
            {agent.name}
          </h1>
          <a
            href={solscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 font-mono text-[12px] text-zinc-400 transition hover:text-emerald-400"
            title={agent.publicKey}
          >
            {shortPk(agent.publicKey)}
            <span aria-hidden="true" className="text-zinc-600">↗</span>
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isActive && (
            <Link
              href={`/topup?agent_id=${agent.id}`}
              className="group inline-flex items-center gap-2 rounded-md border border-emerald-400/60 bg-emerald-400/10 px-3.5 py-2 text-[13px] font-medium text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-400/20 hover:text-emerald-200"
            >
              Fund
              <Kbd>⌘F</Kbd>
            </Link>
          )}
          <Link
            href={`/agents/${agent.id}`}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-[13px] text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
          >
            Full page
          </Link>
          <a
            href={solscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-[13px] text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
          >
            Solscan
            <span aria-hidden="true" className="text-zinc-500">↗</span>
          </a>
        </div>
      </header>

      {/* Metric strip */}
      <section className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800 md:grid-cols-3">
        <Metric
          label="Budget left"
          value={
            remaining && budget
              ? `$${formatUsdg(remaining)}`
              : budget
                ? `$${formatUsdg(budget.capUsdg)}`
                : "—"
          }
          sub={budget ? `${(100 - percent).toFixed(0)}% remaining` : ""}
        />
        <Metric
          label="Spent this cycle"
          value={budget ? `$${formatUsdg(budget.spentUsdg)}` : "—"}
          sub={budget ? `${percent.toFixed(0)}% of cap` : ""}
        />
        <Metric
          label={budget ? `${budget.period} cap` : "Cap"}
          value={budget ? `₹${formatInr(budget.capInr)}` : "—"}
          sub={budget ? `≈ $${formatUsdg(budget.capUsdg)} ${STABLECOIN_TICKER}` : ""}
        />
      </section>

      {/* Budget meter */}
      {budget && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between">
            <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
              Monthly burn
            </div>
            <div className="font-mono text-[12px] text-zinc-400">
              <span className={percent > 85 ? "text-amber-300" : "text-zinc-200"}>
                ${formatUsdg(budget.spentUsdg)}
              </span>
              <span className="text-zinc-600">
                {" "}/ ${formatUsdg(budget.capUsdg)}
              </span>
            </div>
          </div>
          <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-900">
            <div
              className={`absolute left-0 top-0 h-full transition-[width] duration-500 ${
                percent > 85 ? "bg-amber-400" : "bg-emerald-400"
              }`}
              style={{ width: `${percent.toFixed(2)}%` }}
            />
          </div>
        </section>
      )}

      {/* Activity placeholder */}
      <section className="mt-12">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
            Recent activity
          </div>
          <div className="font-mono text-[10px] text-zinc-600">
            Last 24 hrs · Coming soon
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-dashed border-zinc-800 bg-zinc-950/50 p-8 text-center">
          <div className="text-[13px] text-zinc-400">
            Per-call activity lands here once your agent starts spending.
          </div>
          <div className="mt-2 font-mono text-[11px] text-zinc-600">
            settlement, amount, host, latency — all on-chain verifiable
          </div>
        </div>
      </section>

      {/* Status banner for non-active states */}
      {agent.status !== "active" && (
        <section className="mt-8 rounded-lg border border-amber-900/40 bg-amber-950/20 p-5">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-amber-300">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
            {agent.status === "paused" ? "Paused" : "Cancelled"}
          </div>
          <p className="mt-2 text-[13px] leading-[1.55] text-zinc-300">
            {agent.status === "paused"
              ? "This agent is temporarily paused. x402 payments will be rejected until it's resumed."
              : "This agent is cancelled. Its wallet still exists on-chain but cannot sign new payments."}
          </p>
        </section>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-[#0a0a0a] p-6">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 font-mono text-[28px] font-semibold tracking-tight text-zinc-50">
        {value}
      </div>
      {sub && (
        <div className="mt-2 text-[12px] text-zinc-500">{sub}</div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: AgentDTO["status"] }) {
  const map = {
    active: {
      dot: "bg-emerald-400",
      text: "text-emerald-400",
      bg: "bg-emerald-400/10 border-emerald-400/30",
      label: "Active",
    },
    paused: {
      dot: "bg-amber-400",
      text: "text-amber-300",
      bg: "bg-amber-400/10 border-amber-400/30",
      label: "Paused",
    },
    cancelled: {
      dot: "bg-zinc-600",
      text: "text-zinc-400",
      bg: "bg-zinc-800/30 border-zinc-700",
      label: "Cancelled",
    },
  } as const;
  const s = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.1em] ${s.text} ${s.bg}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

function shortPk(pk: string) {
  if (pk.length <= 16) return pk;
  return `${pk.slice(0, 8)}…${pk.slice(-6)}`;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
