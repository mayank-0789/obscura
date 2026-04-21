"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MerchantAppShell } from "@/components/merchants/merchant-app-shell";
import { ApiEditModal } from "@/components/merchants/api-edit-modal";
import {
  useDeleteMerchantApi,
  useMerchantApis,
  type MerchantApi,
} from "@/hooks/use-merchant-apis";
import { formatUsdg } from "@/lib/money-format";

export function MerchantApisShell() {
  const apis = useMerchantApis();
  const deleteApi = useDeleteMerchantApi();
  const [mode, setMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<MerchantApi | null>(null);

  const openCreate = () => {
    setEditing(null);
    setMode("create");
  };
  const openEdit = (api: MerchantApi) => {
    setEditing(api);
    setMode("edit");
  };
  const close = () => {
    setMode(null);
    setEditing(null);
  };

  const onDelete = async (api: MerchantApi) => {
    if (
      !window.confirm(
        `Delete "${api.name}"? Catalog entry only — payments stay recorded in your ledger.`,
      )
    ) {
      return;
    }
    try {
      await deleteApi.mutateAsync(api.id);
      toast.success("API deleted");
    } catch {
      toast.error("Could not delete", { description: "Please try again." });
    }
  };

  return (
    <MerchantAppShell>
      <div className="mx-auto max-w-[960px] px-8 py-10">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[15px] font-medium text-zinc-200">APIs</h1>
            <p className="mt-1 max-w-[560px] text-[13px] leading-[1.6] text-zinc-500">
              Register each paid route you sell. These are display-only —
              your SDK still charges the amount you hardcode in{" "}
              <code className="font-mono text-zinc-400">pay.charge()</code>.
              Registered APIs get friendly names in your dashboard and
              analytics.
            </p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="shrink-0 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-300 transition hover:bg-emerald-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
          >
            + New API
          </button>
        </div>

        <section className="rounded-lg border border-zinc-800 bg-[#0c0c0e]">
          {apis.isLoading ? (
            <div className="p-5">
              <div className="h-12 animate-pulse rounded bg-zinc-900/60" />
            </div>
          ) : !apis.data?.apis.length ? (
            <div className="px-5 py-12 text-center">
              <p className="text-[14px] text-zinc-400">
                No APIs registered yet.
              </p>
              <p className="mt-1 text-[12px] text-zinc-600">
                Click &ldquo;+ New API&rdquo; to add your first paid route.
              </p>
            </div>
          ) : (
            <ul>
              {apis.data.apis.map((api, i) => (
                <li
                  key={api.id}
                  className={
                    i === apis.data.apis.length - 1
                      ? ""
                      : "border-b border-zinc-900"
                  }
                >
                  <ApiRow
                    api={api}
                    onEdit={() => openEdit(api)}
                    onDelete={() => onDelete(api)}
                    deleting={deleteApi.isPending}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <ApiEditModal
        mode={mode ?? "create"}
        initial={editing ?? undefined}
        open={mode !== null}
        onClose={close}
      />
    </MerchantAppShell>
  );
}

function ApiRow({
  api,
  onEdit,
  onDelete,
  deleting,
}: {
  api: MerchantApi;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const priceDisplay = `$${formatUsdg(api.defaultPriceUsdg)}`;

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${
              api.status === "active" ? "bg-emerald-400" : "bg-zinc-600"
            }`}
          />
          <span className="truncate text-[13px] font-medium text-zinc-100">
            {api.name}
          </span>
          {api.status === "paused" ? (
            <span className="rounded border border-zinc-800 px-1.5 py-px font-mono text-[9px] uppercase tracking-widest text-zinc-500">
              paused
            </span>
          ) : null}
        </div>
        <div className="mt-1 flex items-center gap-3 font-mono text-[11px] text-zinc-500">
          <span className="truncate">{api.endpoint}</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <div className="font-mono text-[13px] tabular-nums text-zinc-100">
          {priceDisplay}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">
          per call
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0e]"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400 transition enabled:hover:border-red-500/40 enabled:hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0e]"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
