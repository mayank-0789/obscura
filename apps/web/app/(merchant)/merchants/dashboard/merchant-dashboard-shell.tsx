"use client";

import { MerchantAppShell } from "@/components/merchants/merchant-app-shell";
import { useMerchant } from "@/hooks/use-merchant";
import { useMerchantTransactions } from "@/hooks/use-merchant-transactions";
import { PayoutWalletCard } from "@/components/merchants/payout-wallet-card";
import { MerchantStatsStrip } from "@/components/merchants/merchant-stats-strip";
import { RecentPaymentsList } from "@/components/merchants/recent-payments-list";
import { QuickstartSnippetCard } from "@/components/merchants/quickstart-snippet-card";

export function MerchantDashboardShell() {
  const merchantQuery = useMerchant();
  const txQuery = useMerchantTransactions({ limit: 10 });

  const merchant = merchantQuery.data?.merchant;
  const stats = merchantQuery.data?.stats;

  return (
    <MerchantAppShell>
      <div className="mx-auto max-w-[960px] px-8 py-10">
        <div className="mb-8 flex items-baseline justify-between gap-4">
          <h1 className="text-[15px] font-medium text-zinc-200">Overview</h1>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-zinc-600">
            {merchantQuery.isFetching ? "Refreshing…" : "Updated now"}
          </p>
        </div>

        <div className="space-y-6">
          <PayoutWalletCard
            merchantEtaAddress={merchant?.etaAddress ?? null}
            provisionedAt={merchant?.createdAt ?? null}
          />

          <MerchantStatsStrip stats={stats} />

          <RecentPaymentsList
            transactions={txQuery.data?.transactions}
            isLoading={txQuery.isLoading}
            viewAllHref="/merchants/payments"
          />

          <QuickstartSnippetCard
            merchantEtaAddress={merchant?.etaAddress ?? null}
          />
        </div>
      </div>
    </MerchantAppShell>
  );
}
