import { Connection, type Commitment } from "@solana/web3.js";

// Wraps the Solana RPC client. Apps pass in their own env-validated URL so this
// package stays env-agnostic (same pattern as @payrail-app/db).
//
// Commitment default: "confirmed" — ~400ms–2s finality, effectively irreversible
// for our purposes. Use "finalized" only for bookkeeping that must survive chain
// reorgs (extremely rare on Solana mainnet; never on devnet).
export function createConnection(
  rpcUrl: string,
  commitment: Commitment = "confirmed",
): Connection {
  return new Connection(rpcUrl, commitment);
}
