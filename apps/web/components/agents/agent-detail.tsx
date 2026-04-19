"use client";

import Link from "next/link";
import { solscanAccountUrl } from "@/lib/solscan";
import { formatInr, formatUsdg } from "@/lib/money-format";
import { useAgent } from "@/hooks/use-agent";
import type { AgentDTO } from "@/types/agent";

export function AgentDetail({ id }: { id: string }) {
  const { data: agent, isLoading, error } = useAgent(id);

  if (isLoading) return <AgentDetailSkeleton />;
  if (error?.message === "not_found") return <AgentNotFound />;
  if (error || !agent) return <AgentDetailError />;

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-14">
      <BackLink />
      <Header agent={agent} />
      <div className="grid gap-4 md:grid-cols-2">
        <WalletCard agent={agent} />
        <BudgetCard agent={agent} />
      </div>
      <ActionsCard agent={agent} />
    </main>
  );
}

function BackLink() {
  return (
    <Link
      href="/dashboard"
      className="inline-block text-sm text-zinc-500 transition hover:text-zinc-200"
    >
      ← Back to dashboard
    </Link>
  );
}

function Header({ agent }: { agent: AgentDTO }) {
  return (
    <header>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">
        Agent · {agent.status}
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
        {agent.name}
      </h1>
      <p className="mt-1 font-mono text-xs text-zinc-500">
        Created {new Date(agent.createdAt).toLocaleDateString()}
      </p>
    </header>
  );
}

function WalletCard({ agent }: { agent: AgentDTO }) {
  const solscanUrl = solscanAccountUrl(agent.publicKey);

  return (
    <Card title="Wallet">
      <div className="break-all font-mono text-sm text-zinc-200">
        {agent.publicKey}
      </div>
      <a
        href={solscanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-xs text-zinc-500 transition hover:text-emerald-400"
      >
        View on Solscan →
      </a>
    </Card>
  );
}

function BudgetCard({ agent }: { agent: AgentDTO }) {
  if (!agent.budget) {
    return <Card title="Budget">No budget configured.</Card>;
  }

  return (
    <Card title={`${agent.budget.period} cap`}>
      <div className="text-2xl font-semibold text-zinc-100">
        ₹{formatInr(agent.budget.capInr)}
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        ≈ ${formatUsdg(agent.budget.capUsdg)} USDG at creation
      </p>
      <div className="mt-4 text-xs text-zinc-400">
        Spent this period:{" "}
        <span className="font-mono text-zinc-200">
          ${formatUsdg(agent.budget.spentUsdg)}
        </span>{" "}
        USDG
      </div>
    </Card>
  );
}

function ActionsCard({ agent }: { agent: AgentDTO }) {
  // Buttons are wired when the corresponding API routes ship (Week 2+).
  return (
    <Card title="Actions">
      <div className="flex flex-wrap gap-2">
        <ActionButton disabled label="Rotate API key" />
        <ActionButton
          disabled
          label={agent.status === "active" ? "Pause" : "Resume"}
        />
        <ActionButton disabled label="Cancel" danger />
      </div>
      <p className="mt-3 text-xs text-zinc-500">
        Coming next: key rotation + pause/resume. For now, treat the key you
        saved at creation as the only one.
      </p>
    </Card>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6">
      <div className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">
        {title}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ActionButton({
  label,
  disabled,
  danger,
}: {
  label: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  const base = "rounded-md border px-3 py-1.5 text-xs font-medium transition";
  const color = danger
    ? "border-red-900/50 bg-red-950/30 text-red-300 hover:bg-red-950/50"
    : "border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900";
  return (
    <button
      type="button"
      disabled={disabled}
      className={`${base} ${color} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {label}
    </button>
  );
}

function AgentDetailSkeleton() {
  return (
    <main className="mx-auto max-w-4xl space-y-6 px-6 py-14">
      <div className="h-4 w-32 animate-pulse rounded bg-zinc-900" />
      <div className="h-10 w-64 animate-pulse rounded bg-zinc-900" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-32 animate-pulse rounded-xl bg-zinc-950/60" />
        <div className="h-32 animate-pulse rounded-xl bg-zinc-950/60" />
      </div>
    </main>
  );
}

function AgentNotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold text-zinc-100">Agent not found</h1>
      <p className="mt-2 text-sm text-zinc-500">
        This agent doesn&apos;t exist or isn&apos;t yours.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 inline-block rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-zinc-200 transition hover:bg-zinc-900"
      >
        Back to dashboard
      </Link>
    </main>
  );
}

function AgentDetailError() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold text-zinc-100">
        Couldn&apos;t load this agent
      </h1>
      <p className="mt-2 text-sm text-zinc-500">Try refreshing the page.</p>
    </main>
  );
}

