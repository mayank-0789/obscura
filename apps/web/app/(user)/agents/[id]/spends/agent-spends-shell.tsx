"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { RecentSpendsList } from "@/components/dashboard/recent-spends-list";
import { useAgent } from "@/hooks/use-agent";
import { useAgentSpendsPage } from "@/hooks/use-agent-spends-page";

export function AgentSpendsShell({ id }: { id: string }) {
  const router = useRouter();
  const { data: agent, error } = useAgent(id);
  const spends = useAgentSpendsPage(id, 50);

  if (error?.message === "not_found") {
    return (
      <AppShell
        selectedAgentId={id}
        onSelectAgent={(next) => router.push(`/agents/${next}`)}
      >
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
      </AppShell>
    );
  }

  return (
    <AppShell
      selectedAgentId={id}
      onSelectAgent={(next) => router.push(`/agents/${next}`)}
    >
      <div className="px-8 py-8 lg:px-12">
        <div className="flex items-center gap-2 text-[12px] text-zinc-500">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 transition hover:text-zinc-200"
          >
            Dashboard
          </Link>
          <span className="text-zinc-700">/</span>
          <Link
            href={`/agents/${id}`}
            className="transition hover:text-zinc-200"
          >
            {agent?.name ? (
              agent.name
            ) : (
              <span className="inline-block h-3 w-20 animate-pulse rounded bg-zinc-900 align-middle" />
            )}
          </Link>
          <span className="text-zinc-700">/</span>
          <span className="text-zinc-400">Spends</span>
        </div>

        <div className="mt-6 flex items-baseline justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-zinc-50">
              Spends
            </h1>
            <p className="mt-1 text-[13px] text-zinc-500">
              {agent?.name ? (
                <>
                  Every confirmed on-chain payment {agent.name} has signed.
                </>
              ) : (
                <>Every confirmed on-chain payment this agent has signed.</>
              )}
            </p>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-600">
            {spends.isFetching ? "Refreshing…" : "Updated now"}
          </p>
        </div>

        <div className="mt-6">
          <RecentSpendsList
            transactions={spends.data?.transactions}
            isLoading={spends.isLoading}
          />
        </div>

        {(spends.pageIndex > 0 ||
          (spends.data?.transactions?.length ?? 0) > 0) && (
          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] text-zinc-500">
              Page {spends.pageIndex + 1}
            </span>
            <div className="flex items-center gap-2">
              <PagerButton
                label="← Prev"
                onClick={spends.goPrev}
                disabled={!spends.canGoPrev}
              />
              <PagerButton
                label="Next →"
                onClick={spends.goNext}
                disabled={!spends.canGoNext}
              />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function PagerButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-300 transition enabled:hover:border-zinc-700 enabled:hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
    >
      {label}
    </button>
  );
}
