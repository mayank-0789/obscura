import type { Metadata } from "next";
import { MerchantSettingsShell } from "./merchant-settings-shell";

export const metadata: Metadata = {
  title: "Settings · Obscura Merchant",
  description: "Manage your Obscura merchant API keys.",
};

export default function MerchantSettingsPage() {
  return <MerchantSettingsShell />;
}
