import type { Metadata } from "next";
import { MerchantSettingsShell } from "./merchant-settings-shell";

export const metadata: Metadata = {
  title: "Settings · Payrail Merchant",
  description: "Manage your Payrail merchant API keys.",
};

export default function MerchantSettingsPage() {
  return <MerchantSettingsShell />;
}
