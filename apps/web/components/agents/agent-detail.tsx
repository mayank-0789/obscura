"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { solscanAccountUrl } from "@/lib/solscan";
import {
  formatInr,
  formatUsdg,
  STABLECOIN_TICKER,
} from "@/lib/money-format";
import { useAgent } from "@/hooks/use-agent";
import { useAgentBalance } from "@/hooks/use-agent-balance";
import { useAgentTransactions } from "@/hooks/use-agent-transactions";
import type { AgentDTO } from "@/types/agent";
import { AppShell } from "@/components/dashboard/app-shell";
import { Kbd } from "@/components/dashboard/kbd";
import { RecentSpendsList } from "@/components/dashboard/recent-spends-list";
import { SectionMarker } from "@/components/ui/section-marker";

export function AgentDetail({ id }: { id: string }) {
  const { data: agent, isLoading, error } = useAgent(id);
  const router = useRouter();

  return (
    <AppShell
      selectedAgentId={id}
      onSelectAgent={(nextId) => router.push(`/agents/${nextId}`)}
    >
      {isLoading ? (
        <Skeleton />
      ) : error?.message === "not_found" ? (
        <NotFound />
      ) : error || !agent ? (
        <LoadError />
      ) : (
        <Content agent={agent} />
      )}
    </AppShell>
  );
}

function Content({ agent }: { agent: AgentDTO }) {
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
    <div className="mx-auto max-w-[1280px] px-6 py-10 lg:px-10">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[#888]">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 transition hover:text-[#f5f5f5]"
        >
          ← dashboard
        </Link>
        <span className="text-[#5a5a5a]">/</span>
        <span className="text-[#888]">agents</span>
        <span className="text-[#5a5a5a]">/</span>
        <span className="truncate text-[#f5f5f5]">{agent.name}</span>
      </div>

      <header
        className="mt-6 flex flex-wrap items-start justify-between gap-6 pb-8"
        style={{ borderBottom: "1px solid #1f1f1f" }}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <StatusPill status={agent.status} />
            <span className="font-mono text-[11px] text-[#5a5a5a]">·</span>
            <span className="font-mono text-[11px] text-[#888]">
              Created {formatDate(agent.createdAt)}
            </span>
          </div>
          <h1
            className="mt-4 text-[36px] text-[#f5f5f5] md:text-[44px]"
            style={{ fontWeight: 500, letterSpacing: "-0.025em", lineHeight: 1 }}
          >
            {agent.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={() => copy(agent.etaAddress)}
              className="inline-flex items-center gap-1.5 font-mono text-[12px] text-[#888] transition hover:text-[#f5f5f5]"
              title={agent.etaAddress}
            >
              {shortPk(agent.etaAddress)}
              <span aria-hidden="true" className="text-[#5a5a5a]">⧉</span>
            </button>
            <span className="text-[#5a5a5a]">·</span>
            <a
              href={solscanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[12px] text-[#888] transition hover:text-[#f5f5f5]"
            >
              solscan <span aria-hidden="true" className="text-[#5a5a5a]">↗</span>
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] uppercase tracking-[0.18em]">
          {isActive && (
            <Link
              href={`/topup?agent_id=${agent.id}`}
              className="inline-flex items-center gap-2 border-b pb-1"
              style={{ borderColor: "#e63946", color: "#e63946" }}
            >
              fund
              <Kbd>⌘F</Kbd>
            </Link>
          )}
          <Link
            href={`/dashboard?agent=${agent.id}`}
            className="inline-flex items-center gap-2 border-b pb-1"
            style={{ borderColor: "#888", color: "#888" }}
          >
            open in dashboard
          </Link>
        </div>
      </header>

      {(agent.status === "paused" || agent.status === "cancelled") && (
        <StatusBanner status={agent.status} />
      )}

      <section className="mt-10">
        <SectionMarker index="01" label="Status" />
        <div
          className="mt-6 grid grid-cols-1 md:grid-cols-3"
          style={{ borderTop: "1px solid #f5f5f5" }}
        >
          <Metric
            index="fig. 1.1"
            label="In wallet"
            render={<LiveBalance agentId={agent.id} />}
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

      <section className="mt-10">
        <SectionMarker index="02" label="Credentials" />
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#5a5a5a]">
          on-chain identity and api access
        </p>
        <div className="mt-6" style={{ borderTop: "1px solid #f5f5f5" }}>
          <CredRow
            label="Encrypted account"
            hint="Solana pubkey of the agent's Umbra-side keypair · payments land here as encrypted balance"
            value={agent.etaAddress}
            trailing={
              <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.18em]">
                <button
                  type="button"
                  onClick={() => copy(agent.etaAddress)}
                  className="text-[#888] transition hover:text-[#f5f5f5]"
                >
                  copy
                </button>
                <a
                  href={solscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#888] transition hover:text-[#f5f5f5]"
                >
                  solscan ↗
                </a>
              </div>
            }
          />
          <CredRow
            label="API key"
            hint="Only the hash is stored · rotate to generate a new one"
            value={`${agent.id.slice(0, 8)}••••••••••••••••`}
            valueMuted
            trailing={
              <button
                type="button"
                disabled
                title="Key rotation ships in v2"
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#5a5a5a] disabled:cursor-not-allowed"
              >
                rotate · soon
              </button>
            }
          />
        </div>
      </section>

      <AgentSpendsSection agentId={agent.id} />

      <section className="mt-10">
        <SectionMarker index="04" label="Danger zone" />
        <p
          className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em]"
          style={{ color: "#e63946" }}
        >
          irreversible or disruptive · stubs, wired in v2
        </p>
        <div className="mt-6" style={{ borderTop: "1px solid #e63946" }}>
          <DangerRow
            title="Pause agent"
            body="Temporarily reject new x402 payments. Re-activate anytime."
            cta="pause · soon"
          />
          <DangerRow
            title="Cancel agent"
            body="Archives the agent. The on-chain wallet remains but will not sign again."
            cta="cancel · soon"
          />
        </div>
      </section>

      <div className="pb-16" />
    </div>
  );
}

function Metric({
  index,
  label,
  value,
  render,
  sub,
  withRight = false,
}: {
  index: string;
  label: string;
  value?: string;
  render?: React.ReactNode;
  sub?: string;
  withRight?: boolean;
}) {
  return (
    <div
      className="px-5 py-7"
      style={{
        borderBottom: "1px solid #1f1f1f",
        borderRight: withRight ? "1px solid #1f1f1f" : undefined,
      }}
    >
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
        {index}
      </div>
      <div
        className="mt-3 tabular-nums text-[#f5f5f5]"
        style={{
          fontSize: 32,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {render ?? value}
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

function LiveBalance({ agentId }: { agentId: string }) {
  const { data, isLoading } = useAgentBalance(agentId);
  return <>{isLoading ? "…" : data ? `$${formatUsdg(data.amount)}` : "$0.00"}</>;
}

function AgentSpendsSection({ agentId }: { agentId: string }) {
  const spends = useAgentTransactions(agentId, { limit: 10 });
  return (
    <section className="mt-10">
      <RecentSpendsList
        transactions={spends.data?.transactions}
        isLoading={spends.isLoading}
        viewAllHref={`/agents/${agentId}/spends`}
      />
    </section>
  );
}

function CredRow({
  label,
  hint,
  value,
  valueMuted,
  trailing,
}: {
  label: string;
  hint: string;
  value: string;
  valueMuted?: boolean;
  trailing: React.ReactNode;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 px-1 py-4"
      style={{ borderBottom: "1px solid #1f1f1f" }}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <div className="text-[13px] text-[#f5f5f5]" style={{ fontWeight: 500 }}>
            {label}
          </div>
          <div className="text-[11.5px] text-[#888]">{hint}</div>
        </div>
        <div
          className="mt-2 truncate font-mono text-[12.5px]"
          style={{ color: valueMuted ? "#5a5a5a" : "#f5f5f5" }}
        >
          {value}
        </div>
      </div>
      <div className="shrink-0">{trailing}</div>
    </div>
  );
}

function DangerRow({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <div
      className="flex flex-wrap items-center justify-between gap-4 px-1 py-4"
      style={{ borderBottom: "1px solid #1f1f1f" }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-[#f5f5f5]" style={{ fontWeight: 500 }}>
          {title}
        </div>
        <div className="mt-1 text-[12.5px] text-[#888]">{body}</div>
      </div>
      <button
        type="button"
        disabled
        className="font-mono text-[11px] uppercase tracking-[0.18em] disabled:cursor-not-allowed"
        style={{ color: "#e63946", opacity: 0.6 }}
      >
        {cta}
      </button>
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

function StatusBanner({ status }: { status: "paused" | "cancelled" }) {
  const copy =
    status === "paused"
      ? {
          title: "This agent is paused",
          body: "x402 payments are rejected until it's resumed. Top-ups will be held in the wallet.",
        }
      : {
          title: "This agent is cancelled",
          body: "Archived — no new payments will be signed. The on-chain wallet still exists but is inactive.",
        };

  return (
    <div className="mt-8 p-5" style={{ border: "1px solid #1f1f1f" }}>
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "#888" }}
        />
        {copy.title}
      </div>
      <p className="mt-3 text-[13px] leading-[1.55] text-[#f5f5f5]">
        {copy.body}
      </p>
    </div>
  );
}

function copy(text: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success("Copied", { description: text }))
    .catch(() => toast.error("Couldn't copy"));
}

function shortPk(pk: string) {
  if (pk.length <= 16) return pk;
  return `${pk.slice(0, 8)}…${pk.slice(-6)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-[1280px] space-y-6 px-6 py-10 lg:px-10">
      <div className="h-4 w-48 animate-pulse bg-[#141414]" />
      <div className="h-10 w-72 animate-pulse bg-[#141414]" />
      <div
        className="grid grid-cols-1 md:grid-cols-3"
        style={{ borderTop: "1px solid #f5f5f5" }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-[140px] animate-pulse bg-[#0e0e0e]"
            style={{
              borderBottom: "1px solid #1f1f1f",
              borderRight: i < 2 ? "1px solid #1f1f1f" : undefined,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-full items-center justify-center px-8 py-24 text-center">
      <div className="max-w-xl">
        <h1
          className="text-[28px] text-[#f5f5f5]"
          style={{ fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          Agent not found
        </h1>
        <p className="mt-3 text-[14px] text-[#888]">
          This agent doesn&apos;t exist or isn&apos;t yours.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex items-center gap-2 border-b pb-1 font-mono text-[11px] uppercase tracking-[0.18em]"
          style={{ borderColor: "#f5f5f5", color: "#f5f5f5" }}
        >
          ← back to dashboard
        </Link>
      </div>
    </div>
  );
}

function LoadError() {
  return (
    <div className="flex min-h-full items-center justify-center px-8 py-24 text-center">
      <div className="max-w-xl">
        <h1
          className="text-[28px] text-[#f5f5f5]"
          style={{ fontWeight: 500, letterSpacing: "-0.02em" }}
        >
          Couldn&apos;t load this agent
        </h1>
        <p className="mt-3 text-[14px] text-[#888]">Try refreshing the page.</p>
      </div>
    </div>
  );
}
