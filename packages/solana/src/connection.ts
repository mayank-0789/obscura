import { Connection, type Commitment } from "@solana/web3.js";

// Default "confirmed" — use "finalized" only for bookkeeping that must survive reorgs.
export function createConnection(
  rpcUrl: string,
  commitment: Commitment = "confirmed",
): Connection {
  return new Connection(rpcUrl, commitment);
}
