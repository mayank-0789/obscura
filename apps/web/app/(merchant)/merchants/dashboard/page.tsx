import type { Metadata } from "next";
import { MerchantDashboardShell } from "./merchant-dashboard-shell";

export const metadata: Metadata = {
  title: "Dashboard · Payrail Merchant",
  description: "Your API earnings on Solana.",
};

export default function MerchantDashboardPage() {
  return <MerchantDashboardShell />;
}
