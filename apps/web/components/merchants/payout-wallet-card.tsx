"use client";

import { useState } from "react";
import { toast } from "sonner";
import { env } from "@/lib/env";

export function PayoutWalletCard({
  merchantEtaAddress,
  provisionedAt,
}: {
  merchantEtaAddress: string | null;
  provisionedAt: string | null;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!merchantEtaAddress) return;
    try {
      await navigator.clipboard.writeText(merchantEtaAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  };

  if (!merchantEtaAddress) {
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
      ? `https://solscan.io/account/${merchantEtaAddress}`
      : `https://solscan.io/account/${merchantEtaAddress}?cluster=devnet`;

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
            title={merchantEtaAddress}
          >
            {merchantEtaAddress}
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
            · Paste this into your @obscura-app/merchant-sdk config.
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
