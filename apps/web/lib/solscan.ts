import { env } from "@/lib/env";

// Solscan URL builder. Appends `?cluster=devnet` when we're on devnet so links
// resolve to the right chain without the user picking the network manually.
export function solscanAccountUrl(address: string): string {
  const base = `https://solscan.io/account/${address}`;
  return env.NEXT_PUBLIC_SOLANA_CLUSTER === "devnet"
    ? `${base}?cluster=devnet`
    : base;
}
