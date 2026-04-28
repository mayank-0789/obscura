"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

// One-time reveal banner shown immediately after generating a new API key.
// Mirrors the agent-side RevealApiKeyCard: the plaintext is rendered inline
// and a dismiss action removes the card permanently.
//
// A `beforeunload` listener guards accidental refresh/navigation while the
// plaintext is visible — matches agent-side reveal.
export function RevealMerchantKeyCard({
  label,
  plaintext,
  onDismiss,
}: {
  label: string | null;
  plaintext: string;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(plaintext);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      toast.error("Couldn't copy — select and copy manually.");
    }
  };

  return (
    <section
      aria-live="polite"
      className="rounded-lg border border-emerald-400/40 bg-emerald-500/5 p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
            />
            New key generated
          </div>
          {label ? (
            <p className="mt-1 text-[13px] text-zinc-300">{label}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-md border border-zinc-800 bg-[#0a0a0a]">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <code className="truncate font-mono text-[13px] text-zinc-100">
            {plaintext}
          </code>
          <button
            type="button"
            onClick={copy}
            className={`shrink-0 rounded-md border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a] ${
              copied
                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                : "border-zinc-800 bg-zinc-950 text-zinc-300 hover:border-zinc-700 hover:text-zinc-100"
            }`}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>

      <p className="mt-4 text-[12px] leading-[1.55] text-zinc-400">
        This is the only time you&apos;ll see the plaintext key. Obscura
        stores only a hash — if you lose it, generate a new one and revoke
        this one.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <label className="flex items-center gap-2 text-[12px] text-zinc-300">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-950 text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          />
          I&apos;ve saved this key somewhere safe
        </label>
        <button
          type="button"
          onClick={onDismiss}
          disabled={!acknowledged}
          className="ml-auto rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-300 transition enabled:hover:border-zinc-700 enabled:hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
        >
          Dismiss
        </button>
      </div>
    </section>
  );
}
