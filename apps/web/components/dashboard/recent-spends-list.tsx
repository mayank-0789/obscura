"use client";

import Link from "next/link";
import { formatUsdg } from "@/lib/money-format";
import { env } from "@/lib/env";
import type { AgentTransaction } from "@/hooks/use-agent-transactions";
import { SectionMarker } from "@/components/ui/section-marker";

type Props = {
  transactions: AgentTransaction[] | undefined;
  isLoading: boolean;
  viewAllHref?: string;
};

export function RecentSpendsList({
  transactions,
  isLoading,
  viewAllHref,
}: Props) {
  return (
    <section aria-labelledby="recent-spends-heading">
      <div className="flex items-center justify-between">
        <div id="recent-spends-heading">
          <SectionMarker index="03" label="Recent spends" />
        </div>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#888] transition hover:text-[#f5f5f5] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e63946]"
          >
            view all →
          </Link>
        ) : null}
      </div>

      <div className="mt-6" style={{ borderTop: "1px solid #f5f5f5" }}>
        {isLoading && !transactions ? (
          <LoadingRows />
        ) : !transactions || transactions.length === 0 ? (
          <EmptyState />
        ) : (
          <ul>
            {transactions.map((tx) => (
              <li key={tx.id}>
                <SpendRow tx={tx} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function SpendRow({ tx }: { tx: AgentTransaction }) {
  const when = timeAgo(new Date(tx.createdAt));
  const hostLabel = tx.merchantHost ?? "—";
  const solscanUrl = tx.solanaSig
    ? env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta"
      ? `https://solscan.io/tx/${tx.solanaSig}`
      : `https://solscan.io/tx/${tx.solanaSig}?cluster=devnet`
    : null;

  return (
    <div
      className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-1 px-1 py-3 sm:grid-cols-[110px_1fr_110px_110px] sm:gap-4"
      style={{ borderBottom: "1px solid #1f1f1f" }}
    >
      <span className="order-1 font-mono text-[11px] text-[#888] sm:order-none">{when}</span>
      <span className="order-2 text-right font-mono text-[12px] tabular-nums text-[#f5f5f5] sm:order-4">
        −${formatUsdg(tx.amountUsdg)}
      </span>
      <div className="order-3 col-span-2 min-w-0 sm:order-none sm:col-span-1">
        <div className="truncate text-[13px] text-[#f5f5f5]">{hostLabel}</div>
        <div
          className="mt-0.5 truncate font-mono text-[11px] text-[#5a5a5a]"
          title={tx.counterparty}
        >
          to {shortPk(tx.counterparty)}
        </div>
      </div>
      <span className="order-4 col-span-2 font-mono text-[11px] uppercase tracking-[0.18em] sm:order-3 sm:col-span-1 sm:text-right">
        {solscanUrl ? (
          <a
            href={solscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#888] transition hover:text-[#f5f5f5] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e63946]"
            title="View on Solscan"
          >
            sig ↗
          </a>
        ) : (
          <span className="text-[#5a5a5a]" title="On-chain signature pending">
            pending
          </span>
        )}
      </span>
    </div>
  );
}

function LoadingRows() {
  return (
    <div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="px-1 py-3"
          style={{ borderBottom: "1px solid #1f1f1f" }}
        >
          <div className="h-5 w-full animate-pulse bg-[#141414]" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="px-1 py-10 text-center"
      style={{ borderBottom: "1px solid #1f1f1f" }}
    >
      <p className="text-[13px] text-[#888]">
        No spends yet. Once your agent calls a paid API, payments will show up
        here with on-chain signatures.
      </p>
    </div>
  );
}

function shortPk(pk: string): string {
  if (pk.length <= 12) return pk;
  return `${pk.slice(0, 6)}…${pk.slice(-4)}`;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
