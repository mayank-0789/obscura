"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  // Close drawer when route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const isMissingMerchant =
    error instanceof Error && error.message === "not_found";

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0a] text-[#f5f5f5]">
      <DashboardTopBar
        crumb="merchant"
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close sidebar"
            className="fixed inset-0 top-12 z-30 bg-black/50 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <div
          className={`fixed inset-y-12 left-0 z-40 transition-transform md:static md:inset-auto md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
          }`}
        >
          <MerchantSidebar merchantEtaAddress={merchantEtaAddress} />
        </div>

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
