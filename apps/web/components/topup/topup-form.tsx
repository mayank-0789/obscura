"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAgents } from "@/hooks/use-agents";
import { useCreateTopupSession } from "@/hooks/use-create-topup-session";
import { useTopupQuote } from "@/hooks/use-topup-quote";
import { UnauthorizedError } from "@/hooks/use-authed-fetch";
import { describeError } from "@/lib/error-messages";
import { STABLECOIN_TICKER } from "@/lib/money-format";
import { AppShell } from "@/components/dashboard/app-shell";
import { BreakdownCard } from "@/components/topup/breakdown-card";
import { Kbd } from "@/components/dashboard/kbd";

const PRESETS = [500, 1000, 2500, 5000] as const;
const MIN_INR = 500;
const MAX_INR = 100_000;

export function TopupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialAgentId = searchParams.get("agent_id") ?? "";

  const { data: agents, isLoading: agentsLoading } = useAgents();
  const createSession = useCreateTopupSession();

  const [agentId, setAgentId] = useState<string>(initialAgentId);
  const [amountInr, setAmountInr] = useState<number | "">(500);
  // Sticky flag — prevents a second Dodo session if user clicks during redirect unload.
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (agentId || agentsLoading || !agents || agents.length === 0) return;
    const firstActive = agents.find((a) => a.status === "active") ?? agents[0];
    if (firstActive) setAgentId(firstActive.id);
  }, [agentId, agents, agentsLoading]);

  const selectedAgent = useMemo(
    () => agents?.find((a) => a.id === agentId),
    [agents, agentId],
  );

  const { breakdown, rate, rateSource, loading: quoteLoading } = useTopupQuote(amountInr);

  const amountError =
    amountInr === ""
      ? null
      : typeof amountInr === "number" && amountInr < MIN_INR
        ? `Minimum ₹${MIN_INR.toLocaleString("en-IN")}`
        : typeof amountInr === "number" && amountInr > MAX_INR
          ? `Maximum ₹${MAX_INR.toLocaleString("en-IN")}`
          : null;

  const canSubmit =
    !!selectedAgent &&
    selectedAgent.status === "active" &&
    typeof amountInr === "number" &&
    amountInr >= MIN_INR &&
    amountInr <= MAX_INR &&
    !createSession.isPending &&
    !redirecting;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      const result = await createSession.mutateAsync({
        agentId,
        amountInr: amountInr as number,
        quotedRate: rate ?? undefined,
      });
      setRedirecting(true);
      window.location.href = result.checkoutUrl;
    } catch (err) {
      if (err instanceof UnauthorizedError) return;
      toast.error("Couldn't start checkout", {
        description: describeError(
          err instanceof Error ? err.message : undefined,
        ),
      });
    }
  };

  return (
    <AppShell
      selectedAgentId={agentId || undefined}
      onSelectAgent={(id) => {
        setAgentId(id);
        router.replace(`/topup?agent_id=${id}`, { scroll: false });
      }}
    >
      {agentsLoading ? (
        <Skeleton />
      ) : !agents || agents.length === 0 ? (
        <NoAgentsState />
      ) : (
        <div className="flex min-h-full items-start justify-center px-6 py-12">
          <div className="w-full max-w-xl">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                Top up
              </div>
              <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.015em] text-zinc-50">
                Fund an agent
              </h1>
              <p className="mt-2 text-[14px] leading-[1.55] text-zinc-400">
                UPI or card via Dodo. Funds land in your agent&apos;s Solana
                wallet as {STABLECOIN_TICKER}.
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="mt-8 overflow-hidden rounded-lg border border-zinc-800 bg-[#0c0c0e]"
            >
              <div className="border-b border-zinc-800 px-6 py-5">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                    Agent
                  </span>
                  <div className="relative">
                    <select
                      value={agentId}
                      onChange={(e) => setAgentId(e.target.value)}
                      disabled={createSession.isPending}
                      className="w-full appearance-none rounded-md border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 pr-10 text-[13.5px] text-zinc-100 focus:border-emerald-400/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/20"
                    >
                      {agents.map((agent) => (
                        <option
                          key={agent.id}
                          value={agent.id}
                          disabled={agent.status !== "active"}
                        >
                          {agent.name}
                          {agent.status !== "active"
                            ? ` · ${agent.status}`
                            : ""}
                        </option>
                      ))}
                    </select>
                    <svg
                      viewBox="0 0 12 12"
                      className="pointer-events-none absolute right-3 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-500"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M3 4.5 L6 7.5 L9 4.5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  {selectedAgent && selectedAgent.status !== "active" && (
                    <p className="mt-2 text-[11.5px] text-amber-300">
                      {selectedAgent.status === "paused"
                        ? "Paused agents can't be topped up. Resume first."
                        : "Cancelled agents can't receive top-ups."}
                    </p>
                  )}
                </label>
              </div>

              <div className="border-b border-zinc-800 px-6 py-5">
                <label className="block">
                  <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">
                    Amount
                  </span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-[14px] text-zinc-500">
                      ₹
                    </span>
                    <input
                      type="number"
                      min={MIN_INR}
                      max={MAX_INR}
                      value={amountInr}
                      onChange={(e) =>
                        setAmountInr(
                          e.target.value === ""
                            ? ""
                            : Number(e.target.value),
                        )
                      }
                      disabled={createSession.isPending}
                      className={`w-full rounded-md border bg-zinc-950 py-2.5 pl-8 pr-3.5 text-[14px] font-medium text-zinc-100 focus:outline-none focus:ring-2 ${
                        amountError
                          ? "border-amber-500/60 focus:border-amber-500/60 focus:ring-amber-500/20"
                          : "border-zinc-800 focus:border-emerald-400/60 focus:ring-emerald-400/20"
                      }`}
                    />
                  </div>
                </label>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setAmountInr(p)}
                      disabled={createSession.isPending}
                      className={`rounded-md border px-2.5 py-1 font-mono text-[11.5px] transition ${
                        amountInr === p
                          ? "border-emerald-400/60 bg-emerald-400/10 text-emerald-300"
                          : "border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                      }`}
                    >
                      ₹{p.toLocaleString("en-IN")}
                    </button>
                  ))}
                </div>
                {amountError ? (
                  <p className="mt-3 text-[12px] text-amber-300">
                    {amountError}
                  </p>
                ) : (
                  <p className="mt-3 text-[11.5px] text-zinc-500">
                    Min ₹{MIN_INR.toLocaleString("en-IN")} · Max ₹
                    {MAX_INR.toLocaleString("en-IN")}
                  </p>
                )}
              </div>

              <BreakdownCard
                breakdown={breakdown}
                rateSource={rateSource}
                loading={quoteLoading}
              />

              <div className="flex items-center justify-between gap-2 px-6 py-4">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  disabled={createSession.isPending}
                  className="rounded-md border border-zinc-800 bg-transparent px-3.5 py-2 text-[13px] text-zinc-300 transition hover:border-zinc-700 hover:text-zinc-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="group inline-flex items-center gap-2 rounded-md bg-emerald-400 px-4 py-2 text-[13px] font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {createSession.isPending || redirecting ? (
                    <>
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-black/60 border-t-transparent" />
                      {redirecting ? "Redirecting…" : "Starting…"}
                    </>
                  ) : (
                    <>
                      <span>
                        Pay{" "}
                        {typeof amountInr === "number" ? (
                          <>₹{amountInr.toLocaleString("en-IN")} </>
                        ) : null}
                        via Dodo
                      </span>
                      <span
                        aria-hidden="true"
                        className="transition-transform group-hover:translate-x-0.5"
                      >
                        →
                      </span>
                    </>
                  )}
                </button>
              </div>
            </form>

            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-600">
              <span>
                You&apos;ll be redirected to Dodo&apos;s secure checkout.
              </span>
              <span className="inline-flex items-center gap-1.5">
                Press <Kbd>esc</Kbd> to cancel from Dodo.
              </span>
            </p>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Skeleton() {
  return (
    <div className="flex min-h-full items-start justify-center px-6 py-12">
      <div className="w-full max-w-xl space-y-6">
        <div className="h-4 w-24 animate-pulse rounded bg-zinc-900" />
        <div className="h-10 w-64 animate-pulse rounded bg-zinc-900" />
        <div className="h-80 animate-pulse rounded-lg border border-zinc-800 bg-zinc-950/60" />
      </div>
    </div>
  );
}

function NoAgentsState() {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-12">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 grid h-14 w-14 place-items-center rounded-xl border border-zinc-800 bg-zinc-950">
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6 text-zinc-500"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M12 8v8M8 12h8"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-zinc-50">
          Create an agent first
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[14px] leading-[1.55] text-zinc-400">
          Top-ups land in an agent&apos;s wallet. Create one, then come back to
          fund it.
        </p>
        <Link
          href="/dashboard"
          className="mt-7 inline-flex items-center gap-2 rounded-md bg-emerald-400 px-4 py-2.5 text-[13px] font-semibold text-black transition hover:bg-emerald-300"
        >
          Back to dashboard →
        </Link>
      </div>
    </div>
  );
}
