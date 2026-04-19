import { env } from "@/lib/env";

// Solscan URL builders. Appends `?cluster=devnet` when we're on devnet so
// links resolve to the right chain without the user picking the network.

export function solscanAccountUrl(address: string): string {
  return withCluster(`https://solscan.io/account/${address}`);
}

export function solscanTxUrl(signature: string): string {
  return withCluster(`https://solscan.io/tx/${signature}`);
}

function withCluster(base: string): string {
  return env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet"
    ? `${base}?cluster=devnet`
    : base;
}
