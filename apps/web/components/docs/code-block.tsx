"use client";

import { useState } from "react";

type CodeBlockProps = {
  children: string;
  lang?: string;
  filename?: string;
  /** Disable the copy button for display-only snippets (e.g. shell output). */
  noCopy?: boolean;
};

export function CodeBlock({
  children,
  lang = "ts",
  filename,
  noCopy = false,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  return (
    <figure className="my-8 overflow-hidden rounded-lg border border-zinc-800 bg-[#0b0b0d] shadow-[0_10px_40px_-20px_rgba(0,0,0,0.8)]">
      <header className="flex items-center justify-between border-b border-zinc-800 bg-[#0e0e11] px-4 py-2">
        <div className="flex items-center gap-3 font-mono text-[11px] text-zinc-500">
          {filename && (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-zinc-300">{filename}</span>
              <span className="text-zinc-700">·</span>
            </>
          )}
          <span className="uppercase tracking-[0.2em] text-zinc-600">
            {lang}
          </span>
        </div>
        {!noCopy && (
          <button
            type="button"
            onClick={handleCopy}
            className={`font-mono text-[11px] uppercase tracking-[0.2em] transition ${
              copied
                ? "text-emerald-400"
                : "text-zinc-500 hover:text-zinc-200"
            }`}
            aria-label="Copy code"
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        )}
      </header>
      <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-[1.65] text-zinc-300">
        <code>{children}</code>
      </pre>
    </figure>
  );
}
