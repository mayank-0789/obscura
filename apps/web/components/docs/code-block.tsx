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
    } catch {
      // clipboard unavailable; silent no-op is fine here
    }
  };

  return (
    <figure className="my-8 border border-[#1f1f1f] bg-[#0e0e0e]">
      <header
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid #1f1f1f" }}
      >
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
          {filename && (
            <>
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "#e63946" }}
              />
              <span className="text-[#f5f5f5] normal-case tracking-normal">
                {filename}
              </span>
              <span className="text-[#5a5a5a]">·</span>
            </>
          )}
          <span>{lang}</span>
        </div>
        {!noCopy && (
          <button
            type="button"
            onClick={handleCopy}
            className={`font-mono text-[10px] uppercase tracking-[0.22em] transition ${
              copied ? "text-[#e63946]" : "text-[#888] hover:text-[#f5f5f5]"
            }`}
            aria-label="Copy code"
          >
            {copied ? "copied ✓" : "copy"}
          </button>
        )}
      </header>
      <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-[1.7] text-[#f5f5f5]">
        <code>{children}</code>
      </pre>
    </figure>
  );
}
