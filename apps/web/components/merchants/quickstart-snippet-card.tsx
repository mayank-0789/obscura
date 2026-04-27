"use client";

import { useState } from "react";
import { toast } from "sonner";
import { env } from "@/lib/env";

// Renders a ready-to-paste SDK snippet with the merchant's actual pubkey
// inlined. The goal: a merchant can copy this block into their server.ts
// and it will "just work" against the network the dashboard is configured
// for — no further editing.
export function QuickstartSnippetCard({
  payoutWallet,
}: {
  payoutWallet: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const network =
    env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta"
      ? "solana"
      : "solana-devnet";
  const walletDisplay = payoutWallet ?? "<your-payout-wallet>";

  const snippet = `import express from "express";
import { payrail } from "@obscura-app/merchant-sdk";

const pay = payrail({
  payoutWallet: "${walletDisplay}",
  network: "${network}",
});

const app = express();

app.get(
  "/article/:id",
  pay.charge({ amount: "10000" }),  // $0.01 USDC per call
  (req, res) => res.json({ id: req.params.id, body: "…" }),
);

app.listen(3001);`;

  const handleCopy = async () => {
    if (!payoutWallet) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  };

  return (
    <section
      aria-labelledby="quickstart-heading"
      className="overflow-hidden rounded-lg border border-zinc-800 bg-[#0c0c0e]"
    >
      <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <div className="flex items-center gap-3 font-mono text-[10px] text-zinc-500">
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full bg-emerald-400"
          />
          <span
            id="quickstart-heading"
            className="uppercase tracking-[0.22em]"
          >
            Quick integration
          </span>
          <span className="text-zinc-700">·</span>
          <span className="uppercase tracking-[0.2em] text-zinc-600">TS</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!payoutWallet}
            className={`font-mono text-[11px] uppercase tracking-[0.18em] transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0e] rounded ${
              copied
                ? "text-emerald-400"
                : "text-zinc-500 hover:text-zinc-200"
            }`}
            aria-label="Copy snippet"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <a
            href="/docs/merchants/quickstart"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-500 transition hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0e] rounded"
          >
            Open quickstart ↗
          </a>
        </div>
      </header>
      <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-[1.65] text-zinc-300">
        <code>{snippet}</code>
      </pre>
    </section>
  );
}
