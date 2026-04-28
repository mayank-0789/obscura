import type { Metadata } from "next";
import { MerchantApisShell } from "./merchant-apis-shell";

export const metadata: Metadata = {
  title: "APIs · Obscura Merchant",
  description: "Register the paid API routes you sell through Obscura.",
};

export default function MerchantApisPage() {
  return <MerchantApisShell />;
}
