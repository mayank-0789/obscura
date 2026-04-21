"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MerchantAppShell } from "@/components/merchants/merchant-app-shell";
import { RevealMerchantKeyCard } from "@/components/merchants/reveal-merchant-key-card";
import {
  useCreateMerchantKey,
  useMerchantKeys,
  useRevokeMerchantKey,
  type CreatedMerchantKey,
  type MerchantApiKey,
} from "@/hooks/use-merchant-keys";

export function MerchantSettingsShell() {
  const keys = useMerchantKeys();
  const createKey = useCreateMerchantKey();
  const revokeKey = useRevokeMerchantKey();
  const [label, setLabel] = useState("");
  const [revealed, setRevealed] = useState<CreatedMerchantKey | null>(null);

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await createKey.mutateAsync({
        label: label.trim() || undefined,
      });
      setRevealed(result);
      setLabel("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      toast.error("Could not create key", {
        description:
          msg === "rate_limited"
            ? "You're creating keys too quickly — wait a minute."
            : msg === "forbidden"
              ? "API keys can only be created from the browser session."
              : msg === "bad_request"
                ? "Hit the active-key cap (max 20). Revoke one first."
                : "Please try again.",
      });
    }
  };

  const onRevoke = async (id: string, labelForToast: string) => {
    if (
      !window.confirm(
        `Revoke "${labelForToast}"? Any scripts using this key will start failing immediately.`,
      )
    ) {
      return;
    }
    try {
      await revokeKey.mutateAsync(id);
      toast.success("Key revoked");
    } catch {
      toast.error("Could not revoke key", {
        description: "Please try again.",
      });
    }
  };

  return (
    <MerchantAppShell>
      <div className="mx-auto max-w-[720px] px-8 py-10">
        <div className="mb-8">
          <h1 className="text-[15px] font-medium text-zinc-200">Settings</h1>
          <p className="mt-1 text-[13px] text-zinc-500">
            API keys for programmatic access to your merchant data. Use these
            in scripts, CI, or webhook subscribers.
          </p>
        </div>

        {revealed ? (
          <div className="mb-8">
            <RevealMerchantKeyCard
              label={revealed.key.label}
              plaintext={revealed.plaintext}
              onDismiss={() => setRevealed(null)}
            />
          </div>
        ) : null}

        <section className="rounded-lg border border-zinc-800 bg-[#0c0c0e] p-5">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
            Create a new key
          </h2>
          <form
            onSubmit={onCreate}
            className="mt-4 flex flex-col gap-3 sm:flex-row"
          >
            <label className="sr-only" htmlFor="merchant-key-label">
              Label
            </label>
            <input
              id="merchant-key-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={80}
              placeholder="e.g. CI bot · analytics script"
              className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-[13px] text-zinc-100 placeholder:text-zinc-600 focus-visible:border-emerald-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/40"
            />
            <button
              type="submit"
              disabled={createKey.isPending}
              className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-300 transition enabled:hover:bg-emerald-500/15 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0e]"
            >
              {createKey.isPending ? "Creating…" : "Generate key"}
            </button>
          </form>
        </section>

        <section className="mt-8 rounded-lg border border-zinc-800 bg-[#0c0c0e]">
          <header className="border-b border-zinc-800 px-5 py-3.5">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-500">
              Active keys
            </h2>
          </header>

          {keys.isLoading ? (
            <div className="p-5">
              <div className="h-10 animate-pulse rounded bg-zinc-900/60" />
            </div>
          ) : !keys.data?.keys.length ? (
            <div className="px-5 py-10 text-center text-[13px] text-zinc-500">
              No keys yet. Generate one above to get programmatic access.
            </div>
          ) : (
            <ul>
              {keys.data.keys.map((k, i) => (
                <li
                  key={k.id}
                  className={
                    i === keys.data.keys.length - 1
                      ? ""
                      : "border-b border-zinc-900"
                  }
                >
                  <KeyRow
                    k={k}
                    onRevoke={() =>
                      onRevoke(k.id, k.label ?? "Unlabelled key")
                    }
                    revoking={revokeKey.isPending}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </MerchantAppShell>
  );
}

function KeyRow({
  k,
  onRevoke,
  revoking,
}: {
  k: MerchantApiKey;
  onRevoke: () => void;
  revoking: boolean;
}) {
  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-zinc-200">
          {k.label ?? (
            <span className="text-zinc-500">Unlabelled key</span>
          )}
        </p>
        <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
          Created {formatDate(k.createdAt)} · Last used{" "}
          {k.lastUsedAt ? formatDate(k.lastUsedAt) : "never"}
        </p>
      </div>
      <button
        type="button"
        onClick={onRevoke}
        disabled={revoking}
        className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 transition enabled:hover:border-red-500/40 enabled:hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0e]"
      >
        Revoke
      </button>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
