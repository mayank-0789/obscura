"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useCreateMerchantApi,
  useUpdateMerchantApi,
  type MerchantApi,
} from "@/hooks/use-merchant-apis";
import { formatUsdg } from "@/lib/money-format";

type Props = {
  mode: "create" | "edit";
  initial?: MerchantApi;
  open: boolean;
  onClose: () => void;
};

/** Shared create/edit modal with focus-trap; mode toggles POST vs PATCH. */
export function ApiEditModal({ mode, initial, open, onClose }: Props) {
  const createApi = useCreateMerchantApi();
  const updateApi = useUpdateMerchantApi();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [price, setPrice] = useState("");
  const [status, setStatus] = useState<"active" | "paused">("active");

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      setName(initial.name);
      setEndpoint(initial.endpoint);
      setPrice(initial.defaultPriceUsdg);
      setStatus(initial.status);
    } else {
      setName("");
      setEndpoint("");
      setPrice("10000");
      setStatus("active");
    }
    setTimeout(() => firstInputRef.current?.focus(), 30);
  }, [open, mode, initial]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const isPending = createApi.isPending || updateApi.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "create") {
        await createApi.mutateAsync({
          name,
          endpoint,
          defaultPriceUsdg: price,
          status,
        });
        toast.success("API registered");
      } else if (initial) {
        await updateApi.mutateAsync({
          id: initial.id,
          input: { name, endpoint, defaultPriceUsdg: price, status },
        });
        toast.success("API updated");
      }
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast.error(
        mode === "create" ? "Could not register API" : "Could not update API",
        { description: msg },
      );
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-modal-heading"
        className="w-full max-w-[520px] rounded-lg border border-zinc-800 bg-[#0c0c0e] shadow-[0_20px_80px_-20px_rgba(0,0,0,0.9)]"
      >
        <header className="border-b border-zinc-800 px-5 py-4">
          <h2
            id="api-modal-heading"
            className="text-[15px] font-medium text-zinc-100"
          >
            {mode === "create" ? "Register a new API" : "Edit API"}
          </h2>
          <p className="mt-1 text-[12px] text-zinc-500">
            Catalog entries power the friendly names shown on your dashboard.
            They don&apos;t change what your SDK charges — that stays in your
            code.
          </p>
        </header>

        <form onSubmit={submit} className="space-y-4 px-5 py-5">
          <Field label="Name" htmlFor="api-name">
            <input
              ref={firstInputRef}
              id="api-name"
              type="text"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="News articles"
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            />
          </Field>

          <Field
            label="Endpoint"
            htmlFor="api-endpoint"
            hint="Path like /article/:id, or a full URL — we'll use the path."
          >
            <input
              id="api-endpoint"
              type="text"
              required
              maxLength={400}
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="/article/:id"
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-[13px] text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            />
          </Field>

          <Field
            label="Default price (atomic USDC units)"
            htmlFor="api-price"
            hint="10000 = $0.01 · 100000 = $0.10 · 1000000 = $1.00"
          >
            <input
              id="api-price"
              type="text"
              inputMode="numeric"
              pattern="[0-9]+"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="10000"
              className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-[13px] text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            />
            {/* Live echo so an off-by-a-zero is obvious before Save. */}
            {isPricePositiveInt(price) ? (
              <p className="mt-1.5 font-mono text-[11px] text-emerald-300/80">
                ≈ ${formatUsdg(price)} per call
              </p>
            ) : null}
          </Field>

          <Field label="Status" htmlFor="api-status">
            <div className="flex gap-2">
              <StatusChip
                label="Active"
                selected={status === "active"}
                onClick={() => setStatus("active")}
              />
              <StatusChip
                label="Paused"
                selected={status === "paused"}
                onClick={() => setStatus("paused")}
              />
            </div>
          </Field>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0e]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-300 transition enabled:hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0e]"
            >
              {isPending
                ? "Saving…"
                : mode === "create"
                  ? "Register API"
                  : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function isPricePositiveInt(v: string): boolean {
  if (!/^\d+$/.test(v)) return false;
  try {
    return BigInt(v) > 0n;
  } catch {
    return false;
  }
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500"
      >
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  );
}

function StatusChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-md border px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0e] ${
        selected
          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
          : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );
}
