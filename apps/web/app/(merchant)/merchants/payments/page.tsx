import type { Metadata } from "next";
import { MerchantPaymentsShell } from "./merchant-payments-shell";

export const metadata: Metadata = {
  title: "Payments · Payrail Merchant",
  description: "Full history of confirmed API payments on your Payrail wallet.",
};

export default function MerchantPaymentsPage() {
  return <MerchantPaymentsShell />;
}
