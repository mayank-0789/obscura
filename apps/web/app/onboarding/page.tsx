import type { Metadata } from "next";
import { OnboardingShell } from "./onboarding-shell";

export const metadata: Metadata = {
  title: "Welcome · Payrail",
  description:
    "Pick your role — ship an agent that pays for APIs, or charge per API call. You can do both.",
};

export default function OnboardingPage() {
  return <OnboardingShell />;
}
