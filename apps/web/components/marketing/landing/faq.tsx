"use client";

import { useState } from "react";

export type QA = { q: string; a: React.ReactNode };

export function FAQ({ items }: { items: QA[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-zinc-800 border-y border-zinc-800">
      {items.map((qa, i) => {
        const isOpen = open === i;
        return (
          <div key={i}>
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full items-start gap-3 py-5 text-left transition hover:bg-[#0c0c0e] sm:gap-6 sm:py-6 md:py-8"
            >
              <span className="mt-1 w-10 shrink-0 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500 sm:w-14">
                Q·{String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex-1 font-display text-[17px] font-light leading-[1.3] tracking-tight text-zinc-100 sm:text-[22px] sm:leading-[1.25] md:text-[28px]">
                {qa.q}
              </span>
              <span
                aria-hidden="true"
                className={`mt-1 shrink-0 font-mono text-lg text-emerald-400 transition-transform sm:mt-2 ${
                  isOpen ? "rotate-45" : ""
                }`}
              >
                +
              </span>
            </button>
            <div
              className={`grid overflow-hidden transition-[grid-template-rows] duration-500 ease-out ${
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="min-h-0">
                <div className="flex gap-6 pb-6 pl-12 pr-3 sm:pb-8 sm:pl-20 sm:pr-6">
                  <p className="max-w-[56ch] text-[14px] leading-[1.75] text-zinc-400 sm:text-[15px]">
                    {qa.a}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
