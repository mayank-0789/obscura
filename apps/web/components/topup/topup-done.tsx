"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTopupStatus } from "@/hooks/use-topup-status";
import { solscanTxUrl } from "@/lib/solscan";
import { formatInr, formatUsdg, STABLECOIN_TICKER } from "@/lib/money-format";
import { AppShell } from "@/components/dashboard/app-shell";

/**
 * Landing page after Dodo checkout completes. Dodo redirects here with
 * ?payment_id= &status= appended. We poll server until the webhook lands
 * (transactions row with status='confirmed') and render the appropriate
 * terminal state.
 */
export function TopupDone() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paymentId = searchParams.get("payment_id");
  const dodoStatus = searchParams.get("status");

  return (
    <AppShell
      selectedAgentId={undefined}
      onSelectAgent={(id) => router.push(`/agents/${id}`)}
    >
      {!paymentId ? (
        <MissingPaymentId />
      ) : dodoStatus === "failed" || dodoStatus === "cancelled" ? (
        <DodoFailed status={dodoStatus} />
      ) : (
        <WaitingForConfirmation paymentId={paymentId} />
      )}
    </AppShell>
  );
}

function WaitingForConfirmation({ paymentId }: { paymentId: string }) {
  const { data, error } = useTopupStatus(paymentId);

  if (error) return <StatusError />;
  if (!data || data.state === "pending") return <Pending />;
  if (data.state === "timeout") return <PollTimeout />;
  if (data.state === "failed") return <ServerFailed />;
  return (
    <Confirmed
      amountUsdg={data.amountUsdg}
      amountInr={data.amountInr}
      solanaSig={data.solanaSig}
      agentId={data.agentId}
      agentName={data.agentName}
    />
  );
}

/* ─ STATES ──────────────────────────────────────────────────────── */

function Pending() {
  return (
    <Shell>
      <StateIcon tone="emerald" spinner />
      <StateTitle>Crediting your agent…</StateTitle>
      <StateBody>
        Dodo confirmed your payment. We&apos;re moving{" "}
        {STABLECOIN_TICKER} from our treasury to your agent&apos;s Solana
        wallet.
      </StateBody>

      <ul className="mt-8 w-full max-w-sm space-y-3 text-left">
        <ProgressStep state="done" label="Payment received" hint="Dodo" />
        <ProgressStep
          state="active"
          label={`Transferring ${STABLECOIN_TICKER} on Solana`}
          hint="Helius RPC"
        />
        <ProgressStep
          state="pending"
          label="Crediting agent wallet"
          hint="Usually a few seconds"
        />
      </ul>
    </Shell>
  );
}

function Confirmed({
  amountUsdg,
  amountInr,
  solanaSig,
  agentId,
  agentName,
}: {
  amountUsdg: string;
  amountInr: string | null;
  solanaSig: string | null;
  agentId: string;
  agentName: string;
}) {
  return (
    <Shell>
      <StateIcon tone="emerald">
        <svg viewBox="0 0 20 20" className="h-7 w-7" fill="none" aria-hidden="true">
          <path
            d="M5 10.5 L8.5 14 L15 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </StateIcon>
      <StateTitle>Top-up confirmed</StateTitle>
      <StateBody>
        {amountInr ? (
          <>
            <span className="font-mono text-zinc-200">
              ₹{formatInr(amountInr)}
            </span>{" "}
            →{" "}
          </>
        ) : null}
        <span className="font-mono text-zinc-200">
          ${formatUsdg(amountUsdg)} {STABLECOIN_TICKER}
        </span>{" "}
        credited to{" "}
        <span className="text-zinc-200">{agentName}</span>.
      </StateBody>

      {solanaSig && (
        <a
          href={solscanTxUrl(solanaSig)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-3.5 py-1.5 font-mono text-[12px] text-zinc-300 transition hover:border-emerald-400/50 hover:text-emerald-400"
        >
          View tx on Solscan
          <span aria-hidden="true" className="text-zinc-500">↗</span>
        </a>
      )}

      <div className="mt-10 flex items-center gap-2">
        <Link
          href={`/agents/${agentId}`}
          className="rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2 text-[13px] text-zinc-200 transition hover:border-zinc-700 hover:text-zinc-100"
        >
          Open agent
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md bg-emerald-400 px-4 py-2 text-[13px] font-semibold text-black transition hover:bg-emerald-300"
        >
          Back to dashboard
        </Link>
      </div>
    </Shell>
  );
}

function DodoFailed({ status }: { status: string }) {
  const label = status === "cancelled" ? "cancelled" : "failed";
  return (
    <Shell>
      <StateIcon tone="rose">
        <svg viewBox="0 0 20 20" className="h-7 w-7" fill="none" aria-hidden="true">
          <path
            d="M6 6 L14 14 M14 6 L6 14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </StateIcon>
      <StateTitle>Payment {label}</StateTitle>
      <StateBody>
        Dodo reported the payment as {label}. No funds were moved.
      </StateBody>
      <div className="mt-8 flex items-center gap-2">
        <Link
          href="/topup"
          className="rounded-md bg-emerald-400 px-4 py-2 text-[13px] font-semibold text-black transition hover:bg-emerald-300"
        >
          Try again
        </Link>
        <Link
          href="/dashboard"
          className="rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2 text-[13px] text-zinc-200 transition hover:border-zinc-700"
        >
          Back to dashboard
        </Link>
      </div>
    </Shell>
  );
}

function ServerFailed() {
  return (
    <Shell>
      <StateIcon tone="amber">
        <svg viewBox="0 0 20 20" className="h-7 w-7" fill="none" aria-hidden="true">
          <path
            d="M10 3 L17 16 L3 16 Z M10 9 L10 12 M10 14 L10 14.01"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </StateIcon>
      <StateTitle>We couldn&apos;t credit your agent</StateTitle>
      <StateBody>
        Dodo confirmed the payment but our on-chain transfer hit an error.
        We&apos;re retrying automatically. Your funds are not lost.
      </StateBody>
      <Link
        href="/dashboard"
        className="mt-8 rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2 text-[13px] text-zinc-200 transition hover:border-zinc-700"
      >
        Back to dashboard
      </Link>
    </Shell>
  );
}

function PollTimeout() {
  return (
    <Shell>
      <StateIcon tone="amber">
        <svg viewBox="0 0 20 20" className="h-7 w-7" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M10 6 L10 10 L13 12"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </StateIcon>
      <StateTitle>Taking longer than expected</StateTitle>
      <StateBody>
        Dodo confirmed your payment but we haven&apos;t seen the on-chain
        transfer yet. Check your agent&apos;s balance in a minute. If it still
        isn&apos;t there, contact support with the payment ID.
      </StateBody>
      <Link
        href="/dashboard"
        className="mt-8 rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2 text-[13px] text-zinc-200 transition hover:border-zinc-700"
      >
        Back to dashboard
      </Link>
    </Shell>
  );
}

function StatusError() {
  return (
    <Shell>
      <StateIcon tone="zinc">
        <svg viewBox="0 0 20 20" className="h-7 w-7" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M10 6 L10 11 M10 14 L10 14.01"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </StateIcon>
      <StateTitle>Couldn&apos;t check status</StateTitle>
      <StateBody>
        Refresh this page to try again. Your payment isn&apos;t lost.
      </StateBody>
    </Shell>
  );
}

function MissingPaymentId() {
  return (
    <Shell>
      <StateIcon tone="zinc">
        <svg viewBox="0 0 20 20" className="h-7 w-7" fill="none" aria-hidden="true">
          <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M7 8 Q 7 6, 10 6 Q 13 6, 13 8 Q 13 10, 10 10 L10 12 M10 14.5 L10 14.51"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </StateIcon>
      <StateTitle>Nothing to confirm</StateTitle>
      <StateBody>
        This page is meant to be opened by Dodo after a checkout.
      </StateBody>
      <Link
        href="/dashboard"
        className="mt-8 rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2 text-[13px] text-zinc-200 transition hover:border-zinc-700"
      >
        Back to dashboard
      </Link>
    </Shell>
  );
}

/* ─ PRIMITIVES ──────────────────────────────────────────────────── */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full items-start justify-center px-6 py-20">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        {children}
      </div>
    </div>
  );
}

function StateIcon({
  tone,
  spinner,
  children,
}: {
  tone: "emerald" | "rose" | "amber" | "zinc";
  spinner?: boolean;
  children?: React.ReactNode;
}) {
  const tones = {
    emerald: {
      ring: "border-emerald-400/30 bg-emerald-400/10",
      text: "text-emerald-400",
    },
    rose: {
      ring: "border-rose-400/30 bg-rose-400/10",
      text: "text-rose-400",
    },
    amber: {
      ring: "border-amber-400/30 bg-amber-400/10",
      text: "text-amber-300",
    },
    zinc: {
      ring: "border-zinc-700 bg-zinc-900",
      text: "text-zinc-400",
    },
  } as const;
  const t = tones[tone];
  return (
    <div
      className={`flex h-14 w-14 items-center justify-center rounded-full border ${t.ring} ${t.text}`}
    >
      {spinner ? (
        <span className="block h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : (
        children
      )}
    </div>
  );
}

function StateTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="mt-6 text-[24px] font-semibold tracking-[-0.01em] text-zinc-50 md:text-[26px]">
      {children}
    </h1>
  );
}

function StateBody({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 max-w-md text-[14px] leading-[1.6] text-zinc-400">
      {children}
    </p>
  );
}

function ProgressStep({
  state,
  label,
  hint,
}: {
  state: "done" | "active" | "pending";
  label: string;
  hint: string;
}) {
  return (
    <li className="flex items-center gap-3 rounded-md border border-zinc-800 bg-[#0c0c0e] px-3 py-2.5">
      <StepIcon state={state} />
      <div className="flex-1">
        <div
          className={`text-[13px] ${
            state === "pending" ? "text-zinc-500" : "text-zinc-200"
          }`}
        >
          {label}
        </div>
        <div className="font-mono text-[10.5px] uppercase tracking-[0.15em] text-zinc-600">
          {hint}
        </div>
      </div>
    </li>
  );
}

function StepIcon({ state }: { state: "done" | "active" | "pending" }) {
  if (state === "done") {
    return (
      <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-400/90 text-black">
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" aria-hidden="true">
          <path
            d="M3 6 L5 8 L9 4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className="flex h-5 w-5 items-center justify-center">
        <span className="block h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
      </span>
    );
  }
  return (
    <span className="grid h-5 w-5 place-items-center">
      <span className="block h-2 w-2 rounded-full border border-zinc-700" />
    </span>
  );
}
