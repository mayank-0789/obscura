"use client";

import { useState } from "react";
import { toast } from "sonner";
import { env } from "@/lib/env";
import { SectionMarker } from "@/components/ui/section-marker";

export function QuickstartSnippetCard({
  merchantEtaAddress,
}: {
  merchantEtaAddress: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const network =
    env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta"
      ? "solana"
      : "solana-devnet";
  const etaDisplay = merchantEtaAddress ?? "<your-merchant-eta-address>";

  const snippet = `import express from "express";
import { obscura } from "@obscura-app/merchant-sdk";

const pay = obscura({
  merchantEtaAddress: "${etaDisplay}",
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
    if (!merchantEtaAddress) return;
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  };

  return (
    <section aria-labelledby="quickstart-heading">
      <div className="flex items-center justify-between">
        <div id="quickstart-heading">
          <SectionMarker index="04" label="Quick integration" />
        </div>
        <div className="flex items-center gap-4 font-mono text-[11px] uppercase tracking-[0.18em]">
          <span className="text-[#5a5a5a]">ts</span>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!merchantEtaAddress}
            className="transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e63946]"
            style={{ color: copied ? "#e63946" : "#888" }}
            aria-label="Copy snippet"
          >
            {copied ? "copied ✓" : "copy"}
          </button>
          <a
            href="/docs/merchants/quickstart"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#888] transition hover:text-[#f5f5f5] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e63946]"
          >
            open quickstart ↗
          </a>
        </div>
      </div>
      <div
        className="mt-6"
        style={{
          borderTop: "1px solid #f5f5f5",
          borderBottom: "1px solid #1f1f1f",
        }}
      >
        <pre
          className="overflow-x-auto p-5 font-mono text-[13px] leading-[1.65] text-[#f5f5f5]"
          style={{ backgroundColor: "#0e0e0e" }}
        >
          <code>{snippet}</code>
        </pre>
      </div>
    </section>
  );
}
