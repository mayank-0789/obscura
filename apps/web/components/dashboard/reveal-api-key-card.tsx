"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

type Props = {
  agentName: string;
  apiKey: string;
  onDismiss: () => void;
};

/** Plaintext API key shown once; beforeunload warns before nav/refresh. */
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
    <div
      className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3"
      style={{ border: "1px solid #e63946", backgroundColor: "#0e0e0e" }}
    >
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em]">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "#e63946" }}
        />
        <span style={{ color: "#e63946" }}>save this key</span>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-2 text-[12.5px]">
        <span className="text-[#888]">
          API key for{" "}
          <span className="text-[#f5f5f5]">{agentName}</span> — shown once.
        </span>
      </div>

      <div
        className="flex min-w-0 items-center gap-2 pl-3"
        style={{ border: "1px solid #1f1f1f", backgroundColor: "#0a0a0a" }}
      >
        <code className="min-w-0 truncate font-mono text-[12.5px] text-[#f5f5f5]">
          {apiKey}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e63946]"
          style={{
            backgroundColor: copied ? "#e63946" : "#141414",
            color: copied ? "#0a0a0a" : "#f5f5f5",
          }}
        >
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#888] transition hover:text-[#f5f5f5] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#e63946]"
      >
        dismiss
      </button>
    </div>
  );
}
