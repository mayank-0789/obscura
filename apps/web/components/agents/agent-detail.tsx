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
import type { AgentDTO } from "@/types/agent";
import { AppShell } from "@/components/dashboard/app-shell";
import { Kbd } from "@/components/dashboard/kbd";

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
  const solscanUrl = solscanAccountUrl(agent.publicKey);
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
    <div className="px-8 py-8 lg:px-12">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[12px] text-zinc-500">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 transition hover:text-zinc-200"
        >
          <svg
            viewBox="0 0 12 12"
            className="h-3 w-3"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M7.5 2.5 L3 6 L7.5 9.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Dashboard
        </Link>
        <span className="text-zinc-700">/</span>
        <span className="text-zinc-400">Agents</span>
        <span className="text-zinc-700">/</span>
        <span className="truncate text-zinc-300">{agent.name}</span>
      </div>

      {/* Header */}
      <header className="mt-6 flex flex-wrap items-start justify-between gap-6 border-b border-zinc-800 pb-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <StatusPill status={agent.status} />
            <span className="font-mono text-[11px] text-zinc-600">·</span>
            <span className="font-mono text-[11px] text-zinc-500">
              Created {formatDate(agent.createdAt)}
            </span>
          </div>
          <h1 className="mt-3 text-[32px] font-semibold tracking-[-0.015em] text-zinc-50 md:text-[36px]">
            {agent.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <button
              type="button"
              onClick={() => copy(agent.publicKey)}
              className="inline-flex items-center gap-1.5 font-mono text-[12px] text-zinc-400 transition hover:text-zinc-200"
              title={agent.publicKey}
            >
              {shortPk(agent.publicKey)}
              <svg
                viewBox="0 0 12 12"
                className="h-3 w-3 text-zinc-600"
                fill="none"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" />
                <path d="M2 8.5 L2 2 L8.5 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
            </button>
            <span className="text-zinc-700">·</span>
            <a
              href={solscanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[12px] text-zinc-400 transition hover:text-emerald-400"
            >
              Solscan
              <span aria-hidden="true" className="text-zinc-600">↗</span>
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isActive && (
            <Link
              href={`/topup?agent_id=${agent.id}`}
              className="inline-flex items-center gap-2 rounded-md border border-emerald-400/60 bg-emerald-400/10 px-3.5 py-2 text-[13px] font-medium text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-400/20 hover:text-emerald-200"
            >
              Fund
              <Kbd>⌘F</Kbd>
            </Link>
          )}
          <Link
            href={`/dashboard?agent=${agent.id}`}
            className="inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-[13px] text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
          >
            Open in dashboard
          </Link>
        </div>
      </header>

      {/* Status banner for non-active */}
      {(agent.status === "paused" || agent.status === "cancelled") && (
        <StatusBanner status={agent.status} />
      )}

      {/* Metrics strip */}
      <section className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800 md:grid-cols-3">
        <Metric label="In wallet" render={<LiveBalance agentId={agent.id} />} sub={`${STABLECOIN_TICKER} · held by agent`} />
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

      {/* Credentials */}
      <section className="mt-10">
        <SectionHeader
          title="Credentials"
          hint="On-chain identity and API access"
        />
        <div className="mt-4 overflow-hidden rounded-lg border border-zinc-800">
          <CredRow
            label="Wallet"
            hint="Solana public key · funds land here"
            value={agent.publicKey}
            trailing={
              <div className="flex items-center gap-2">
                <GhostButton onClick={() => copy(agent.publicKey)}>
                  Copy
                </GhostButton>
                <a
                  href={solscanUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-zinc-800 px-3 py-1.5 text-[12px] text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100"
                >
                  Solscan
                  <span aria-hidden="true" className="text-zinc-500">↗</span>
                </a>
              </div>
            }
          />
          <CredRow
            label="API key"
            hint="Only the hash is stored · rotate to generate a new one"
            value={`${agent.id.slice(0, 8)}••••••••••••••••`}
            valueClass="text-zinc-500"
            trailing={
              <GhostButton
                disabled
                title="Key rotation ships in v2"
              >
                Rotate · soon
              </GhostButton>
            }
          />
          <CredRow
            label="Privy wallet ID"
            hint="Used for delegated signing · not sensitive"
            value={agent.privyWalletId}
            trailing={
              <GhostButton onClick={() => copy(agent.privyWalletId)}>
                Copy
              </GhostButton>
            }
          />
        </div>
      </section>

      {/* Danger zone */}
      <section className="mt-10">
        <SectionHeader
          title="Danger zone"
          hint="Irreversible or disruptive · stubs, wired in v2"
          tone="danger"
        />
        <div className="mt-4 overflow-hidden rounded-lg border border-rose-900/40">
          <DangerRow
            title="Pause agent"
            body="Temporarily reject new x402 payments. Re-activate anytime."
            cta="Pause · soon"
          />
          <DangerRow
            title="Cancel agent"
            body="Archives the agent. The on-chain wallet remains but will not sign again."
            cta="Cancel · soon"
          />
        </div>
      </section>

      <div className="pb-16" />
    </div>
  );
}

/* ─ subcomponents ─ */

function Metric({
  label,
  value,
  render,
  sub,
}: {
  label: string;
  value?: string;
  render?: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="bg-[#0a0a0a] p-6">
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </div>
      <div className="mt-2 font-mono text-[26px] font-semibold tracking-tight text-zinc-50 md:text-[30px]">
        {render ?? value}
      </div>
      {sub && <div className="mt-2 text-[12px] text-zinc-500">{sub}</div>}
    </div>
  );
}

function LiveBalance({ agentId }: { agentId: string }) {
  const { data, isLoading } = useAgentBalance(agentId);
  return <>{isLoading ? "…" : data ? `$${formatUsdg(data.amount)}` : "$0.00"}</>;
}

function SectionHeader({
  title,
  hint,
  tone = "default",
}: {
  title: string;
  hint?: string;
  tone?: "default" | "danger";
}) {
  return (
    <div className="flex items-baseline justify-between">
      <div
        className={`text-[11px] font-medium uppercase tracking-[0.12em] ${
          tone === "danger" ? "text-rose-300" : "text-zinc-400"
        }`}
      >
        {title}
      </div>
      {hint && <div className="font-mono text-[10.5px] text-zinc-600">{hint}</div>}
    </div>
  );
}

function CredRow({
  label,
  hint,
  value,
  valueClass,
  trailing,
}: {
  label: string;
  hint: string;
  value: string;
  valueClass?: string;
  trailing: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 bg-[#0c0c0e] px-5 py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-3">
          <div className="text-[13px] font-medium text-zinc-200">{label}</div>
          <div className="text-[11.5px] text-zinc-500">{hint}</div>
        </div>
        <div
          className={`mt-2 truncate font-mono text-[12.5px] ${
            valueClass ?? "text-zinc-300"
          }`}
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
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-rose-900/30 bg-[#120a0c] px-5 py-4 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-zinc-100">{title}</div>
        <div className="mt-1 text-[12.5px] text-zinc-400">{body}</div>
      </div>
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-2 rounded-md border border-rose-900/60 bg-rose-950/30 px-3.5 py-1.5 text-[12.5px] font-medium text-rose-300 opacity-70"
      >
        {cta}
      </button>
    </div>
  );
}

function GhostButton({
  children,
  onClick,
  disabled,
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[12px] text-zinc-300 transition enabled:hover:border-zinc-700 enabled:hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
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
    <div className="mt-6 rounded-lg border border-amber-900/40 bg-amber-950/20 p-4">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-amber-300">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        {copy.title}
      </div>
      <p className="mt-1.5 text-[13px] leading-[1.55] text-zinc-300">{copy.body}</p>
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

/* ─ fallback states ─ */

function Skeleton() {
  return (
    <div className="space-y-6 px-8 py-8 lg:px-12">
      <div className="h-4 w-48 animate-pulse rounded bg-zinc-900" />
      <div className="h-10 w-72 animate-pulse rounded bg-zinc-900" />
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-zinc-800 bg-zinc-800 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[108px] animate-pulse bg-zinc-950/60" />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-lg border border-zinc-800 bg-zinc-950/60" />
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-full items-center justify-center px-8 py-24 text-center">
      <div className="max-w-xl">
        <h1 className="text-[24px] font-semibold text-zinc-50">
          Agent not found
        </h1>
        <p className="mt-2 text-[14px] text-zinc-500">
          This agent doesn&apos;t exist or isn&apos;t yours.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2 text-[13px] text-zinc-200 transition hover:border-zinc-700"
        >
          ← Back to dashboard
        </Link>
      </div>
    </div>
  );
}

function LoadError() {
  return (
    <div className="flex min-h-full items-center justify-center px-8 py-24 text-center">
      <div className="max-w-xl">
        <h1 className="text-[24px] font-semibold text-zinc-50">
          Couldn&apos;t load this agent
        </h1>
        <p className="mt-2 text-[14px] text-zinc-500">Try refreshing the page.</p>
      </div>
    </div>
  );
}
