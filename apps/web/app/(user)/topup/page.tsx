import { Suspense } from "react";
import { TopupForm } from "@/components/topup/topup-form";

export default function TopupPage() {
  return (
    <Suspense fallback={null}>
      <TopupForm />
    </Suspense>
  );
}
