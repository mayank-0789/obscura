"use client";

import Link from "next/link";
import { useUser } from "@/hooks/use-user";
import { AgentsSection } from "./agents-section";
import { WalletCard, WalletPendingCard } from "./wallet-card";

export function DashboardContent() {
  const { data, isLoading, error } = useUser();

  const greeting = isLoading
    ? "Loading…"
    : error
      ? "Hi there"
      : `Hi${data?.user.email ? `, ${data.user.email}` : ""}`;

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-14">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">
          Your dashboard
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl">
          {greeting}
        </h1>
        {error && (
          <p className="mt-3 text-sm text-zinc-400">
            Couldn&apos;t load your profile. Try refreshing.
          </p>
        )}
      </header>

      {data?.solanaAddress ? (
        <WalletCard address={data.solanaAddress} />
      ) : isLoading ? null : (
        <WalletPendingCard />
      )}

      <AgentsSection />

      <Link
        href="/"
        className="block text-sm text-zinc-500 transition hover:text-zinc-300"
      >
        ← Back to home
      </Link>
    </main>
  );
}
