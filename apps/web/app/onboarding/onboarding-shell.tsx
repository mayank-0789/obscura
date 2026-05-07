"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useSignout } from "@/hooks/use-signout";
import { useSyncUser } from "@/hooks/use-sync-user";
import { useUser } from "@/hooks/use-user";
import { useSetRole } from "@/hooks/use-set-role";
import { RoleCard } from "@/components/onboarding/role-card";
import { SectionMarker } from "@/components/ui/section-marker";
import {
  ONBOARDED_KEY,
  destinationForRole,
  type Role,
} from "@/lib/onboarding";

export function OnboardingShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // `?upgrade=1` lets an already-onboarded user re-enter the picker.
  const upgrade = searchParams.get("upgrade") === "1";
  const { status } = useSession();
  const ready = status !== "loading";
  const authenticated = status === "authenticated";
  const signOut = useSignout();
  // SignInButton isn't on this page, so mount /api/auth/sync explicitly —
  // otherwise a fresh signup could choose a role before the users row exists.
  useSyncUser();
  const { data: me, isLoading: meLoading, isFetched: meFetched } = useUser();
  const setRole = useSetRole();
  const [pending, setPending] = useState<Role | null>(null);

  useEffect(() => {
    if (ready && !authenticated) {
      router.replace("/");
    }
  }, [ready, authenticated, router]);

  // `onboardedAt` is the source of truth across devices; `?upgrade=1` opts
  // back into the picker.
  useEffect(() => {
    if (!meFetched || !me) return;
    if (!me.user.onboardedAt) return;
    if (upgrade) return;
    if (typeof window !== "undefined") {
      localStorage.setItem(ONBOARDED_KEY, "1");
    }
    router.replace(destinationForRole(me.user.role as Role));
  }, [meFetched, me, router, upgrade]);

  const choose = async (role: Role) => {
    if (pending) return;
    if (!meFetched || !me) return;
    setPending(role);
    try {
      await setRole.mutateAsync(role);
      if (typeof window !== "undefined") {
        localStorage.setItem(ONBOARDED_KEY, "1");
      }
      // replace, not push — back button shouldn't return to /onboarding.
      router.replace(destinationForRole(role));
      setPending(null);
    } catch (err) {
      setPending(null);
      const message = err instanceof Error ? err.message : "unknown";
      const description =
        message === "rate_limited"
          ? "You're going too fast — wait a moment and retry."
          : message === "bad_request"
            ? "Server rejected the request. Refresh and try again."
            : message === "user_not_synced"
              ? "Your session is still warming up. Try again in a second."
              : "Please try again.";
      toast.error("Could not save your choice", { description });
    }
  };

  const showSkeleton = !ready || meLoading || (!meFetched && authenticated);

  return (
    <div
      className="min-h-screen bg-[#0a0a0a] font-sans text-[#f5f5f5] antialiased"
      style={{ fontFeatureSettings: '"ss01", "cv11", "tnum"' } as CSSProperties}
    >
      <header className="border-b border-[#1f1f1f]">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-5">
          <div className="flex items-baseline gap-3">
            <Link
              href="/"
              className="text-[15px] font-medium tracking-[-0.01em] focus-visible:outline-none"
            >
              obscura
            </Link>
            <span className="font-mono text-[10px] text-[#5a5a5a]">───</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#888]">
              welcome
            </span>
          </div>
          <button
            onClick={signOut}
            className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#888] transition hover:text-[#f5f5f5] focus-visible:outline-none"
          >
            sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-6 py-16 md:py-24">
        {showSkeleton ? (
          <OnboardingSkeleton />
        ) : (
          <>
            <SectionMarker index="00" label="Pick your side of the rail" />

            <h1
              className="mt-10 text-balance"
              style={{
                fontSize: "clamp(40px, 6vw, 64px)",
                fontWeight: 500,
                letterSpacing: "-0.025em",
                lineHeight: 1.02,
              }}
            >
              How will you use{" "}
              <span style={{ color: "#888", fontWeight: 300 }}>the rail?</span>
            </h1>
            <p className="mt-8 max-w-[60ch] text-[15.5px] leading-[1.65] text-[#888]">
              Obscura has two sides — pick one to start, or choose both.
            </p>
            <p className="mt-2 text-[13px] text-[#5a5a5a]">
              You can add the other side anytime from your dashboard.
            </p>

            <div className="mt-14 grid grid-cols-1 gap-px md:grid-cols-2">
              <RoleCard
                kicker="01 / agent developer"
                title="Ship an agent that pays for APIs."
                body="Install @obscura-app/sdk, drop in an API key, point fetch at a paid endpoint. Your agent pays in stablecoins automatically — no wallet code."
                features={[
                  "One SDK key per agent",
                  "Monthly spend caps",
                  "Fund with UPI or card",
                ]}
                onClick={() => choose("user")}
                isLoading={pending === "user"}
                disabled={!!pending && pending !== "user"}
              />
              <RoleCard
                kicker="02 / api provider"
                title="Charge per API call."
                body="Install @obscura-app/merchant-sdk, wrap an Express route with pay.charge. Get paid in USDC on Solana directly to your Obscura-managed wallet."
                features={[
                  "Managed Solana payout wallet",
                  "Live earnings dashboard",
                  "Get paid in USDC",
                ]}
                onClick={() => choose("merchant")}
                isLoading={pending === "merchant"}
                disabled={!!pending && pending !== "merchant"}
              />
            </div>

            <div
              className="mt-14 flex flex-col items-start gap-4 pt-10 md:flex-row md:items-center md:justify-between"
              style={{ borderTop: "1px solid #1f1f1f" }}
            >
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#888]">
                  doing both?
                </div>
                <p className="mt-2 text-[14px] leading-[1.55] text-[#888]">
                  Get both dashboards with one account. Switch between them
                  from the top bar.
                </p>
              </div>
              <button
                onClick={() => choose("both")}
                disabled={!!pending}
                className="inline-flex items-center gap-2 border-b border-[#f5f5f5] pb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[#f5f5f5] transition disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none"
              >
                <span>
                  {pending === "both" ? "setting up…" : "set up both"}
                </span>
                <span aria-hidden>→</span>
              </button>
            </div>

            <p className="mt-12 font-mono text-[11px] uppercase tracking-[0.16em] text-[#5a5a5a]">
              new here?{" "}
              <Link
                href="/docs"
                className="text-[#888] hover:text-[#f5f5f5] focus-visible:outline-none"
              >
                read the docs first →
              </Link>
            </p>
          </>
        )}
      </main>
    </div>
  );
}

function OnboardingSkeleton() {
  return (
    <div aria-hidden>
      <div className="mb-4 h-3 w-20 bg-[#141414]" />
      <div className="h-12 w-3/4 bg-[#141414]" />
      <div className="mt-3 h-5 w-1/2 bg-[#0e0e0e]" />
      <div className="mt-14 grid grid-cols-1 gap-px md:grid-cols-2">
        <div className="h-[300px] border border-[#1f1f1f]" />
        <div className="h-[300px] border border-[#1f1f1f]" />
      </div>
    </div>
  );
}
