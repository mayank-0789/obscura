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
      <div className="mx-auto max-w-[1280px] px-6 py-10 lg:px-10">
        <div className="mb-8 flex items-baseline justify-between gap-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
            <span style={{ color: "#e63946" }}>●</span>{" "}
            {merchantQuery.isFetching ? "refreshing…" : "updated now"}
          </p>
        </div>

        <div className="space-y-12">
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
