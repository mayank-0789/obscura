"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

type Props = {
  agentName: string;
  apiKey: string;
  onDismiss: () => void;
};

// Plaintext API key shown once. Server stores only a hash; leaving without
// copying means rotating from the agent page. The beforeunload handler warns
// on navigation/refresh while this card is visible.
export function RevealApiKeyCard({ agentName, apiKey, onDismiss }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-lg border border-emerald-400/40 bg-emerald-400/5 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-300">
          Save this key
        </span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px] text-zinc-300">
        <span className="text-zinc-500">
          API key for <span className="text-zinc-200">{agentName}</span> —
          shown once.
        </span>
      </div>

      <div className="flex min-w-0 items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 pl-3">
        <code className="min-w-0 truncate font-mono text-[12.5px] text-zinc-100">
          {apiKey}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className={`rounded-r-md px-3 py-1.5 font-mono text-[11px] font-medium transition ${
            copied
              ? "bg-emerald-400 text-black"
              : "bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
          }`}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="text-[11.5px] text-zinc-500 transition hover:text-zinc-200"
      >
        Dismiss
      </button>
    </div>
  );
}
