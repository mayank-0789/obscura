"use client";

import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useCreateAgent } from "@/hooks/use-create-agent";
import type { CreateAgentResult } from "@/hooks/use-create-agent";
import { describeError } from "@/lib/error-messages";
import { STABLECOIN_TICKER } from "@/lib/money-format";
import { UnauthorizedError } from "@/hooks/use-authed-fetch";
import { Kbd } from "./kbd";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (result: CreateAgentResult) => void;
};

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

const PRESETS = [500, 1000, 2500, 5000];

export function CreateAgentModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [capInr, setCapInr] = useState<number | "">("");
  const formRef = useRef<HTMLFormElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const createAgent = useCreateAgent();

  useEffect(() => {
    if (!open) return;
    setName("");
    setCapInr("");
    const previouslyFocused = document.activeElement as HTMLElement | null;
    firstInputRef.current?.focus();
    return () => {
      previouslyFocused?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !createAgent.isPending) {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !formRef.current) return;

      const targets = formRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (targets.length === 0) return;
      const first = targets[0]!;
      const last = targets[targets.length - 1]!;
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, createAgent.isPending]);

  if (!open) return null;

  const canSubmit =
    name.trim().length > 0 &&
    typeof capInr === "number" &&
    capInr > 0 &&
    !createAgent.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      const result = await createAgent.mutateAsync({
        name: name.trim(),
        monthlyCapInr: capInr as number,
      });
      onCreated(result);
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
      toast.error("Couldn't create agent", {
        description: describeError(
          err instanceof Error ? err.message : undefined,
        ),
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#0a0a0a]/80 px-4 py-8 sm:pt-[12vh]"
      onClick={() => !createAgent.isPending && onClose()}
    >
      <form
        ref={formRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-md overflow-hidden border border-[#1f1f1f] bg-[#0a0a0a]"
      >
        <header className="flex items-center justify-between border-b border-[#1f1f1f] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span
              className="font-mono text-[10px] uppercase tracking-[0.22em]"
              style={{ color: "#e63946" }}
            >
              new
            </span>
            <span
              aria-hidden
              className="inline-block h-px w-6"
              style={{ backgroundColor: "#f5f5f5" }}
            />
            <h2
              id={titleId}
              className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#f5f5f5]"
            >
              agent
            </h2>
          </div>
          <div className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[#888] sm:flex">
            <Kbd>esc</Kbd>
            <span>close</span>
          </div>
          <button
            type="button"
            onClick={() => !createAgent.isPending && onClose()}
            aria-label="Close"
            className="font-mono text-[14px] text-[#888] transition hover:text-[#f5f5f5] sm:hidden"
          >
            ✕
          </button>
        </header>

        <div className="px-5 py-6">
          <Field label="Name" hint="Shown in your dashboard.">
            <input
              ref={firstInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Trading bot"
              maxLength={60}
              disabled={createAgent.isPending}
              className="w-full border border-[#1f1f1f] bg-transparent px-3 py-2 text-[13.5px] text-[#f5f5f5] placeholder:text-[#5a5a5a] focus:border-[#e63946] focus:outline-none disabled:opacity-50"
            />
          </Field>

          <div className="mt-6">
            <Field
              label="Monthly spend cap"
              hint={`Hard cap · ${STABLECOIN_TICKER} equivalent locked at creation.`}
            >
              <div className="flex items-stretch gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-[#5a5a5a]">
                    ₹
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={1_000_000}
                    value={capInr}
                    onChange={(e) =>
                      setCapInr(
                        e.target.value === "" ? "" : Number(e.target.value),
                      )
                    }
                    placeholder="500"
                    disabled={createAgent.isPending}
                    className="w-full border border-[#1f1f1f] bg-transparent py-2 pl-7 pr-3 text-[13.5px] tabular-nums text-[#f5f5f5] placeholder:text-[#5a5a5a] focus:border-[#e63946] focus:outline-none disabled:opacity-50"
                  />
                </div>
                <span className="inline-flex items-center border border-[#1f1f1f] px-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
                  inr
                </span>
              </div>
            </Field>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => {
                const active = capInr === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCapInr(p)}
                    disabled={createAgent.isPending}
                    className={`border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] tabular-nums disabled:opacity-50 ${
                      active
                        ? "border-[#e63946] text-[#e63946]"
                        : "border-[#1f1f1f] text-[#888] hover:text-[#f5f5f5]"
                    }`}
                  >
                    ₹{p.toLocaleString("en-IN")}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-[#1f1f1f] px-5 py-3">
          <span className="hidden items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#888] sm:flex">
            <Kbd>↵</Kbd>
            <span>create</span>
          </span>
          <div className="ml-auto flex items-center gap-5">
            <button
              type="button"
              onClick={onClose}
              disabled={createAgent.isPending}
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#888] hover:text-[#f5f5f5] disabled:opacity-40"
            >
              cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`inline-flex items-center gap-2 border px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] disabled:cursor-not-allowed disabled:opacity-40 ${
                canSubmit
                  ? "border-[#e63946] text-[#e63946]"
                  : "border-[#1f1f1f] text-[#888]"
              }`}
            >
              {canSubmit && (
                <span
                  aria-hidden
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: "#e63946" }}
                />
              )}
              {createAgent.isPending ? "creating…" : "create agent"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-2 block text-[11.5px] leading-[1.5] text-[#5a5a5a]">
          {hint}
        </span>
      )}
    </label>
  );
}
