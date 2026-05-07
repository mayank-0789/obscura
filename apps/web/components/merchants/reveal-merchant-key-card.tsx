"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

/** One-time merchant key reveal; beforeunload guards while plaintext shows. */
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
      className="p-5"
      style={{ border: "1px solid #e63946", backgroundColor: "#0e0e0e" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em]">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "#e63946" }}
            />
            <span style={{ color: "#e63946" }}>new key generated</span>
          </div>
          {label ? (
            <p className="mt-2 text-[13px] text-[#f5f5f5]">{label}</p>
          ) : null}
        </div>
      </div>

      <div
        className="mt-5"
        style={{ border: "1px solid #1f1f1f", backgroundColor: "#0a0a0a" }}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <code className="truncate font-mono text-[13px] text-[#f5f5f5]">
            {plaintext}
          </code>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e63946]"
            style={{
              border: "1px solid",
              borderColor: copied ? "#e63946" : "#1f1f1f",
              color: copied ? "#e63946" : "#f5f5f5",
              backgroundColor: copied ? "rgba(230,57,70,0.08)" : "#0a0a0a",
            }}
          >
            {copied ? "copied ✓" : "copy"}
          </button>
        </div>
      </div>

      <p className="mt-5 text-[12px] leading-[1.6] text-[#888]">
        This is the only time you&apos;ll see the plaintext key. Obscura stores
        only a hash — if you lose it, generate a new one and revoke this one.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-[12px] text-[#f5f5f5]">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="h-3.5 w-3.5 accent-[#e63946] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e63946]"
            style={{ backgroundColor: "#0a0a0a" }}
          />
          I&apos;ve saved this key somewhere safe
        </label>
        <button
          type="button"
          onClick={onDismiss}
          disabled={!acknowledged}
          className="ml-auto border-b pb-1 font-mono text-[11px] uppercase tracking-[0.18em] transition disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e63946]"
          style={{ borderColor: "#888", color: "#888" }}
        >
          dismiss
        </button>
      </div>
    </section>
  );
}
