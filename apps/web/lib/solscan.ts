import { env } from "@/lib/env";

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
