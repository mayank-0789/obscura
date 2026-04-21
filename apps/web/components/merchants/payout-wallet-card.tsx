"use client";

import { useState } from "react";
import { toast } from "sonner";
import { env } from "@/lib/env";

// Hero card. Shows the full payout wallet, a copy-to-clipboard button, and a
// Solscan deep-link scoped to the current network. Clipboard success state
// flips to "Copied ✓" in emerald for ~1.2s then reverts.
export function PayoutWalletCard({
  payoutWallet,
  provisionedAt,
}: {
  payoutWallet: string | null;
  provisionedAt: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!payoutWallet) return;
    try {
      await navigator.clipboard.writeText(payoutWallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  };

  if (!payoutWallet) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-[#0c0c0e] p-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
          Payout wallet
        </div>
        <div className="mt-3 flex items-center gap-2 text-[14px] text-zinc-500">
          <span
            aria-hidden
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-600"
          />
          Provisioning your Solana wallet…
        </div>
      </div>
    );
  }

  const solscanUrl =
    env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta"
      ? `https://solscan.io/account/${payoutWallet}`
      : `https://solscan.io/account/${payoutWallet}?cluster=devnet`;

  return (
    <section
      aria-labelledby="payout-wallet-heading"
      className="rounded-lg border border-zinc-800 bg-[#0c0c0e] p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2
            id="payout-wallet-heading"
            className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500"
          >
            Payout wallet
          </h2>
          <p
            className="mt-2 truncate font-mono text-[16px] text-zinc-100"
            title={payoutWallet}
          >
            {payoutWallet}
          </p>
          <p className="mt-1.5 text-[12px] text-zinc-500">
            Provisioned{" "}
            {provisionedAt
              ? new Date(provisionedAt).toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : "—"}{" "}
            · Paste this into your @payrail/merchant-sdk config.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className={`rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0e] ${
              copied
                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
            }`}
            aria-label="Copy payout wallet address"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <a
            href={solscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0e]"
          >
            Solscan ↗
          </a>
        </div>
      </div>
    </section>
  );
}
