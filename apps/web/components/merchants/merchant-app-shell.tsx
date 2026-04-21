"use client";

import { DashboardTopBar } from "@/components/dashboard/dashboard-top-bar";
import { MerchantSidebar } from "./merchant-sidebar";
import { MissingMerchantState } from "./missing-merchant-state";
import { useMerchant } from "@/hooks/use-merchant";
import { useMerchantEvents } from "@/hooks/use-merchant-events";

/**
 * Authenticated merchant-side chrome. Mirrors the agent AppShell's structure
 * (sticky top bar + left sidebar + scrollable main) but with a merchant
 * sidebar and no create-agent/command-palette wiring.
 *
 * Also owns the "no merchant on this login" branch so every page under
 * /merchants/* handles it uniformly — Payments, Settings, APIs all get the
 * register CTA without their own 404 plumbing.
 */
export function MerchantAppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data, error, isLoading } = useMerchant();
  // Subscribe to the real-time payment stream for every merchant surface so
  // any of them reflect a new payment within ~1 frame of landing on-chain.
  useMerchantEvents();
  const payoutWallet = data?.merchant.payoutWallet ?? null;

  const isMissingMerchant =
    error instanceof Error && error.message === "not_found";

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0a] text-zinc-100">
      <DashboardTopBar crumb="Merchant dashboard" />

      <div className="flex min-h-0 flex-1">
        <MerchantSidebar payoutWallet={payoutWallet} />

        <main className="min-w-0 flex-1 overflow-y-auto bg-[#0a0a0a]">
          {isMissingMerchant ? (
            <MissingMerchantState />
          ) : isLoading && !data ? (
            // Thin loading pass — each child renders its own skeletons.
            <>{children}</>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
