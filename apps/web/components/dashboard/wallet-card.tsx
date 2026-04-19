import { env } from "@/lib/env";

export function WalletCard({ address }: { address: string }) {
  const cluster = env.NEXT_PUBLIC_SOLANA_CLUSTER;
  const solscanUrl =
    cluster === "devnet"
      ? `https://solscan.io/account/${address}?cluster=devnet`
      : `https://solscan.io/account/${address}`;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-6">
      <div className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-400">
        Your Solana wallet
      </div>
      <div className="mt-3 break-all font-mono text-sm text-zinc-300">
        {address}
      </div>
      <a
        href={solscanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-block text-xs text-zinc-500 transition hover:text-emerald-400"
      >
        View on Solscan →
      </a>
    </section>
  );
}

export function WalletPendingCard() {
  return (
    <section className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-6">
      <div className="font-mono text-xs uppercase tracking-[0.2em] text-amber-400">
        Wallet pending
      </div>
      <p className="mt-3 text-sm text-zinc-300">
        Privy is creating your Solana wallet. Usually takes 5–30 seconds —
        refresh in a moment.
      </p>
    </section>
  );
}
