import type { Metadata } from "next";
import { MerchantApisShell } from "./merchant-apis-shell";

export const metadata: Metadata = {
  title: "APIs · Payrail Merchant",
  description: "Register the paid API routes you sell through Payrail.",
};

export default function MerchantApisPage() {
  return <MerchantApisShell />;
}
