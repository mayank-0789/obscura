"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCreateAgent } from "@/hooks/use-create-agent";
import type { CreateAgentResult } from "@/hooks/use-create-agent";
import { describeError } from "@/lib/error-messages";
import { UnauthorizedError } from "@/hooks/use-authed-fetch";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (result: CreateAgentResult) => void;
};

export function CreateAgentModal({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [capInr, setCapInr] = useState<number | "">("");
  const firstInputRef = useRef<HTMLInputElement>(null);
  const createAgent = useCreateAgent();

  // Autofocus + reset on open.
  useEffect(() => {
    if (!open) return;
    setName("");
    setCapInr("");
    firstInputRef.current?.focus();
  }, [open]);

  // Esc to close (respects in-flight mutation).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !createAgent.isPending) onClose();
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
      // 401 is already being handled upstream — useAuthedFetch kicks off a
      // sign-out, so we don't want a misleading "create failed" toast on top.
      if (err instanceof UnauthorizedError) return;
      toast.error("Couldn't create agent", {
        description: describeError(err instanceof Error ? err.message : undefined),
      });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={() => !createAgent.isPending && onClose()}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl border border-zinc-800 bg-[#0a0a0a] p-6 shadow-2xl"
      >
        <header className="mb-5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">
            New agent
          </p>
          <h2 className="mt-2 text-xl font-semibold text-zinc-100">
            Create an agent
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            A dedicated Solana wallet is created for this agent. Top-ups land
            here and x402 payments come out of here.
          </p>
        </header>

        <label className="block text-sm">
          <span className="text-zinc-400">Name</span>
          <input
            ref={firstInputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Trading bot"
            maxLength={60}
            disabled={createAgent.isPending}
            className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
        </label>

        <label className="mt-4 block text-sm">
          <span className="text-zinc-400">Monthly spend cap (INR)</span>
          <input
            type="number"
            min={1}
            max={1_000_000}
            value={capInr}
            onChange={(e) =>
              setCapInr(e.target.value === "" ? "" : Number(e.target.value))
            }
            placeholder="500"
            disabled={createAgent.isPending}
            className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            Hard cap enforced per calendar month. Stored in INR; USDG
            equivalent locked at creation.
          </span>
        </label>

        <footer className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={createAgent.isPending}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createAgent.isPending ? "Creating…" : "Create agent"}
          </button>
        </footer>
      </form>
    </div>
  );
}
