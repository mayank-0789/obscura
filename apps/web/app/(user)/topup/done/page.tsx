import { Suspense } from "react";
import { TopupDone } from "@/components/topup/topup-done";

export default function TopupDonePage() {
  return (
    <Suspense fallback={null}>
      <TopupDone />
    </Suspense>
  );
}
