"use client";

import Link from "next/link";
import { useAgentBalance } from "@/hooks/use-agent-balance";
import { useAgentTransactions } from "@/hooks/use-agent-transactions";
import { solscanAccountUrl } from "@/lib/solscan";
import {
  formatInr,
  formatUsdg,
  STABLECOIN_TICKER,
} from "@/lib/money-format";
import type { AgentDTO } from "@/types/agent";
import { Kbd } from "./kbd";
import { RecentSpendsList } from "./recent-spends-list";
import { SectionMarker } from "@/components/ui/section-marker";

export function AgentDetailPanel({ agent }: { agent: AgentDTO }) {
  const { data: balance } = useAgentBalance(agent.id);
  const spends = useAgentTransactions(agent.id, { limit: 10 });
  const solscanUrl = solscanAccountUrl(agent.etaAddress);
  const isActive = agent.status === "active";

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
    <div className="px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10 lg:px-12">
      {/* Header */}
      <header
        className="flex flex-wrap items-start justify-between gap-4 pb-6 sm:gap-6 sm:pb-8"
        style={{ borderBottom: "1px solid #1f1f1f" }}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <StatusPill status={agent.status} />
            <span className="hidden font-mono text-[11px] text-[#5a5a5a] sm:inline">·</span>
            <span className="font-mono text-[11px] text-[#888]">
              Created {formatDate(agent.createdAt)}
            </span>
          </div>
          <h1
            className="mt-4 break-words text-[24px] text-[#f5f5f5] sm:text-[28px] md:text-[32px]"
            style={{ fontWeight: 500, letterSpacing: "-0.02em", lineHeight: 1.05 }}
          >
            {agent.name}
          </h1>
          <a
            href={solscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 font-mono text-[12px] text-[#888] transition hover:text-[#f5f5f5]"
            title={agent.etaAddress}
          >
            {shortPk(agent.etaAddress)}
            <span aria-hidden="true" className="text-[#5a5a5a]">↗</span>
          </a>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 font-mono text-[11px] uppercase tracking-[0.18em]">
          {isActive && (
            <Link
              href={`/topup?agent_id=${agent.id}`}
              className="inline-flex items-center gap-2 border-b pb-1 transition"
              style={{ borderColor: "#e63946", color: "#e63946" }}
            >
              fund
              <Kbd>⌘F</Kbd>
            </Link>
          )}
          <Link
            href={`/agents/${agent.id}`}
            className="inline-flex items-center gap-2 border-b pb-1 transition"
            style={{ borderColor: "#f5f5f5", color: "#f5f5f5" }}
          >
            full page
          </Link>
          <a
            href={solscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border-b pb-1 transition"
            style={{ borderColor: "#888", color: "#888" }}
          >
            solscan ↗
          </a>
        </div>
      </header>

      {/* Metric strip */}
      <section className="mt-8 sm:mt-10">
        <SectionMarker index="01" label="Status" />
        <div
          className="mt-6 grid grid-cols-1 md:grid-cols-3"
          style={{ borderTop: "1px solid #f5f5f5" }}
        >
          <Metric
            index="fig. 1.1"
            label="In wallet"
            value={balance ? `$${formatUsdg(balance.amount)}` : "…"}
            sub={`${STABLECOIN_TICKER} · held by agent`}
            withRight
          />
          <Metric
            index="fig. 1.2"
            label="Spent this cycle"
            value={budget ? `$${formatUsdg(budget.spentUsdg)}` : "—"}
            sub={budget ? `${percent.toFixed(0)}% of cap` : ""}
            withRight
          />
          <Metric
            index="fig. 1.3"
            label={budget ? `${budget.period} cap` : "Cap"}
            value={budget ? `₹${formatInr(budget.capInr)}` : "—"}
            sub={
              budget
                ? `≈ $${formatUsdg(budget.capUsdg)} ${STABLECOIN_TICKER}`
                : ""
            }
          />
        </div>
      </section>

      {/* Budget meter */}
      {budget && (
        <section className="mt-10">
          <SectionMarker index="02" label="Monthly burn" />
          <div className="mt-6 flex items-baseline justify-between">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#888]">
              {percent.toFixed(0)}% of cap
            </div>
            <div className="font-mono text-[12px] tabular-nums">
              <span
                style={{
                  color: percent > 85 ? "#e63946" : "#f5f5f5",
                }}
              >
                ${formatUsdg(budget.spentUsdg)}
              </span>
              <span className="text-[#5a5a5a]">
                {" "}/ ${formatUsdg(budget.capUsdg)}
              </span>
            </div>
          </div>
          <div
            className="relative mt-3 h-px w-full"
            style={{ backgroundColor: "#1f1f1f" }}
          >
            <div
              className="absolute left-0 top-0 h-px transition-[width] duration-500"
              style={{
                width: `${percent.toFixed(2)}%`,
                backgroundColor: percent > 85 ? "#e63946" : "#f5f5f5",
              }}
            />
          </div>
        </section>
      )}

      {/* Recent spends — paid calls this agent has made. Mirrors the
          merchant dashboard's RecentPaymentsList but flipped: same rows in
          `transactions`, read from the other side. */}
      <section className="mt-12">
        <RecentSpendsList
          transactions={spends.data?.transactions}
          isLoading={spends.isLoading}
          viewAllHref={`/agents/${agent.id}/spends`}
        />
      </section>

      {/* Status banner for non-active states */}
      {agent.status !== "active" && (
        <section
          className="mt-10 p-5"
          style={{ border: "1px solid #1f1f1f" }}
        >
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "#888" }}
            />
            {agent.status === "paused" ? "Paused" : "Cancelled"}
          </div>
          <p className="mt-3 text-[13px] leading-[1.55] text-[#f5f5f5]">
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
  index,
  label,
  value,
  sub,
  withRight = false,
}: {
  index: string;
  label: string;
  value: string;
  sub?: string;
  withRight?: boolean;
}) {
  return (
    <div
      className="px-5 py-5 sm:py-6 md:[border-right:var(--mr)]"
      style={
        {
          borderBottom: "1px solid #1f1f1f",
          ["--mr" as string]: withRight ? "1px solid #1f1f1f" : "none",
        } as React.CSSProperties
      }
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
        {index}
      </div>
      <div
        className="mt-3 tabular-nums text-[#f5f5f5]"
        style={{
          fontSize: "clamp(22px, 5vw, 28px)",
          fontWeight: 500,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <p className="mt-4 text-[12.5px] leading-[1.55] text-[#f5f5f5]">
        {label}
      </p>
      {sub ? (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#888]">
          {sub}
        </p>
      ) : null}
    </div>
  );
}

function StatusPill({ status }: { status: AgentDTO["status"] }) {
  const map = {
    active: { dot: "#e63946", label: "Active" },
    paused: { dot: "#888", label: "Paused" },
    cancelled: { dot: "#5a5a5a", label: "Cancelled" },
  } as const;
  const s = map[status];
  return (
    <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: s.dot }}
      />
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
