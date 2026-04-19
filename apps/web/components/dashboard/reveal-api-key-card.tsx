"use client";

import { useState } from "react";
import { toast } from "sonner";

type Props = {
  agentName: string;
  apiKey: string;
  onDismiss: () => void;
};

// Shows the plaintext agent API key once. The key is not recoverable after
// dismissal — only the hash is stored server-side — so the UI makes that
// very explicit.
export function RevealApiKeyCard({ agentName, apiKey, onDismiss }: Props) {
  const [copied, setCopied] = useState(false);

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
    <section className="rounded-xl border border-emerald-800/50 bg-emerald-950/20 p-6">
      <div className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">
        API key for {agentName}
      </div>
      <p className="mt-2 text-sm text-zinc-300">
        Copy this now. It is shown only once — we store a hash, not the key
        itself. If you lose it, rotate it from the agent page.
      </p>
      <div className="mt-4 flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/80 px-3 py-2 font-mono text-sm">
        <span className="flex-1 truncate text-zinc-200">{apiKey}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs text-zinc-100 transition hover:bg-zinc-800"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-4 text-xs text-zinc-400 transition hover:text-zinc-200"
      >
        I&apos;ve saved it — dismiss
      </button>
    </section>
  );
}
