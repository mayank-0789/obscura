"use client";

import { useState } from "react";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { SectionMarker } from "@/components/ui/section-marker";

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
      <section aria-labelledby="payout-wallet-heading">
        <div id="payout-wallet-heading">
          <SectionMarker index="00" label="Payout wallet" />
        </div>
        <div
          className="mt-6 px-1 py-6"
          style={{
            borderTop: "1px solid #f5f5f5",
            borderBottom: "1px solid #1f1f1f",
          }}
        >
          <div className="flex items-center gap-2 text-[14px] text-[#888]">
            <span
              aria-hidden
              className="h-1.5 w-1.5 animate-pulse rounded-full"
              style={{ backgroundColor: "#888" }}
            />
            Provisioning your Solana wallet…
          </div>
        </div>
      </section>
    );
  }

  const solscanUrl =
    env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta"
      ? `https://solscan.io/account/${merchantEtaAddress}`
      : `https://solscan.io/account/${merchantEtaAddress}?cluster=devnet`;

  return (
    <section aria-labelledby="payout-wallet-heading">
      <div id="payout-wallet-heading">
        <SectionMarker index="00" label="Payout wallet" />
      </div>
      <div
        className="mt-6 px-1 py-6"
        style={{
          borderTop: "1px solid #f5f5f5",
          borderBottom: "1px solid #1f1f1f",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p
              className="truncate font-mono text-[16px] text-[#f5f5f5]"
              title={merchantEtaAddress}
              style={{ letterSpacing: "-0.005em" }}
            >
              {merchantEtaAddress}
            </p>
            <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
              <span style={{ color: "#5a5a5a" }}>provisioned</span>{" "}
              {provisionedAt
                ? new Date(provisionedAt).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "—"}
            </p>
            <p className="mt-2 text-[12px] leading-[1.55] text-[#888]">
              Paste this into your @obscura-app/merchant-sdk config.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-4 font-mono text-[11px] uppercase tracking-[0.18em]">
            <button
              type="button"
              onClick={handleCopy}
              className="border-b pb-1 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e63946]"
              style={{
                borderColor: copied ? "#e63946" : "#f5f5f5",
                color: copied ? "#e63946" : "#f5f5f5",
              }}
              aria-label="Copy payout wallet address"
            >
              {copied ? "copied ✓" : "copy"}
            </button>
            <a
              href={solscanUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="border-b pb-1 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e63946]"
              style={{ borderColor: "#888", color: "#888" }}
            >
              solscan ↗
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
