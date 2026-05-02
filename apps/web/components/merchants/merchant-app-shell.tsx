"use client";

import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { MerchantSidebar } from "./merchant-sidebar";
import { MissingMerchantState } from "./missing-merchant-state";
import { useMerchant } from "@/hooks/use-merchant";
import { useMerchantEvents } from "@/hooks/use-merchant-events";

/** Authed merchant chrome; centralizes the "no merchant row" branch. */
export function MerchantAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data, error, isLoading } = useMerchant();
  useMerchantEvents();
  const merchantEtaAddress = data?.merchant.etaAddress ?? null;

  const isMissingMerchant =
    error instanceof Error && error.message === "not_found";

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0a] text-zinc-100">
      <DashboardTopBar crumb="Merchant dashboard" />

      <div className="flex min-h-0 flex-1">
        <MerchantSidebar merchantEtaAddress={merchantEtaAddress} />

        <main className="min-w-0 flex-1 overflow-y-auto bg-[#0a0a0a]">
          {isMissingMerchant ? (
            <MissingMerchantState />
          ) : isLoading && !data ? (
            <>{children}</>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
