"use client";

import { MerchantAppShell } from "@/components/merchants/merchant-app-shell";
import { RecentPaymentsList } from "@/components/merchants/recent-payments-list";
import { useMerchantPaymentsPage } from "@/hooks/use-merchant-payments-page";

export function MerchantPaymentsShell() {
  const payments = useMerchantPaymentsPage(50);

  return (
    <MerchantAppShell>
      <div className="mx-auto max-w-[960px] px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10">
        <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3 sm:mb-8 sm:gap-4">
          <div>
            <h1 className="text-[15px] font-medium text-zinc-200">Payments</h1>
            <p className="mt-1 text-[13px] text-zinc-500">
              Every confirmed on-chain payment to your payout wallet.
            </p>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-600">
            {payments.isFetching ? "Refreshing…" : "Updated now"}
          </p>
        </div>

        <RecentPaymentsList
          transactions={payments.data?.transactions}
          isLoading={payments.isLoading}
        />

        {/* Hide the pager when there's nothing to paginate — a new merchant's
            first visit shouldn't show dead Prev/Next buttons under the empty
            state. Show it from page 2 onward, or when the first page has
            data + a next cursor. */}
        {(payments.pageIndex > 0 ||
          (payments.data?.transactions?.length ?? 0) > 0) && (
          <div className="mt-5 flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] text-zinc-500">
              Page {payments.pageIndex + 1}
            </span>
            <div className="flex items-center gap-2">
              <PagerButton
                label="← Prev"
                onClick={payments.goPrev}
                disabled={!payments.canGoPrev}
              />
              <PagerButton
                label="Next →"
                onClick={payments.goNext}
                disabled={!payments.canGoNext}
              />
            </div>
          </div>
        )}
      </div>
    </MerchantAppShell>
  );
}

function PagerButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-300 transition enabled:hover:border-zinc-700 enabled:hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
    >
      {label}
    </button>
  );
}
