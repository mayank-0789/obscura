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
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 px-4 pt-[12vh] backdrop-blur-sm"
      onClick={() => !createAgent.isPending && onClose()}
    >
      <form
        ref={formRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-md overflow-hidden rounded-lg border border-zinc-800 bg-[#0c0c0e] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]"
      >
        <header className="flex items-center justify-between border-b border-zinc-800 px-5 py-3.5">
          <h2 id={titleId} className="text-[14px] font-semibold text-zinc-100">
            New agent
          </h2>
          <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-500">
            <Kbd>esc</Kbd>
            to close
          </div>
        </header>

        <div className="px-5 py-5">
          <Field label="Name" hint="Shown in your dashboard.">
            <input
              ref={firstInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Trading bot"
              maxLength={60}
              disabled={createAgent.isPending}
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-[13.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
            />
          </Field>

          <div className="mt-5">
            <Field
              label="Monthly spend cap"
              hint={`Hard cap · ${STABLECOIN_TICKER} equivalent locked at creation.`}
            >
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] text-zinc-500">
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
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 py-2 pl-7 pr-3 text-[13.5px] text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                  />
                </div>
                <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-zinc-600">
                  INR
                </span>
              </div>
            </Field>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setCapInr(p)}
                  disabled={createAgent.isPending}
                  className={`rounded-md border px-2.5 py-1 font-mono text-[11.5px] transition ${
                    capInr === p
                      ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
                      : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                  }`}
                >
                  ₹{p.toLocaleString("en-IN")}
                </button>
              ))}
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-zinc-800 bg-[#08080a] px-5 py-3">
          <span className="flex items-center gap-2 font-mono text-[10.5px] text-zinc-500">
            <Kbd>↵</Kbd>
            to create
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={createAgent.isPending}
              className="rounded-md border border-zinc-800 bg-transparent px-3.5 py-2 text-[13px] text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="rounded-md bg-emerald-400 px-3.5 py-2 text-[13px] font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {createAgent.isPending ? "Creating…" : "Create agent"}
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
      <span className="mb-1.5 block text-[12px] font-medium text-zinc-300">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1.5 block text-[11.5px] text-zinc-500">{hint}</span>
      )}
    </label>
  );
}
