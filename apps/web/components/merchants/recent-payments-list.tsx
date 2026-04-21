"use client";

import Link from "next/link";
import { formatUsdg } from "@/lib/money-format";
import { env } from "@/lib/env";
import type { MerchantTransaction } from "@/hooks/use-merchant-transactions";

type Props = {
  transactions: MerchantTransaction[] | undefined;
  isLoading: boolean;
  viewAllHref?: string;
};

export function RecentPaymentsList({
  transactions,
  isLoading,
  viewAllHref,
}: Props) {
  return (
    <section
      aria-labelledby="recent-payments-heading"
      className="rounded-lg border border-zinc-800 bg-[#0c0c0e]"
    >
      <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
        <h2
          id="recent-payments-heading"
          className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500"
        >
          Recent payments
        </h2>
        {viewAllHref ? (
          <Link
            href={viewAllHref}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500 transition hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0e] rounded"
          >
            View all →
          </Link>
        ) : null}
      </header>

      {isLoading && !transactions ? (
        <LoadingRows />
      ) : !transactions || transactions.length === 0 ? (
        <EmptyState />
      ) : (
        <ul>
          {transactions.map((tx, i) => (
            <li
              key={tx.id}
              className={
                i === transactions.length - 1
                  ? ""
                  : "border-b border-zinc-900"
              }
            >
              <PaymentRow tx={tx} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PaymentRow({ tx }: { tx: MerchantTransaction }) {
  const when = timeAgo(new Date(tx.createdAt));
  const hostLabel = tx.merchantHost ?? "—";
  const payerShort = shortId(tx.agentId);
  const solscanUrl = tx.solanaSig
    ? env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta"
      ? `https://solscan.io/tx/${tx.solanaSig}`
      : `https://solscan.io/tx/${tx.solanaSig}?cluster=devnet`
    : null;

  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          aria-hidden
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400"
        />
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="truncate font-mono text-[13px] text-zinc-200">
              {hostLabel}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-zinc-500">
              {when}
            </span>
          </div>
          <div className="mt-0.5 font-mono text-[11px] text-zinc-500">
            from agent {payerShort}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <span className="font-mono text-[14px] tabular-nums text-emerald-300">
          +${formatUsdg(tx.amountUsdg)}
        </span>
        {solscanUrl ? (
          <a
            href={solscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 transition hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0e] rounded"
            title="View on Solscan"
          >
            sig ↗
          </a>
        ) : (
          <span
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-700"
            title="On-chain signature pending"
          >
            pending
          </span>
        )}
      </div>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="divide-y divide-zinc-900">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-3.5">
          <div className="h-9 w-full animate-pulse rounded bg-zinc-900/60" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-[13px] text-zinc-500">
        No payments yet. Your first earning will show up here in real time.
      </p>
    </div>
  );
}

function shortId(id: string): string {
  if (id.length <= 10) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
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
