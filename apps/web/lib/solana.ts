import "server-only";
import {
  createConnection,
  keypairFromSecret,
  PublicKey,
  type Connection,
  type Keypair,
} from "@payrail-app/solana";
import { env } from "@/lib/env";

// Server-only Solana client singletons. Match the pattern used by lib/dodo/client,
// lib/privy-server, and lib/db — one cached instance per process, constructed on
// first use so env-validation errors surface during route execution (where we
// can turn them into a clean 500) rather than at module load.

let cachedConnection: Connection | null = null;
let cachedTreasury: Keypair | null = null;
let cachedMint: PublicKey | null = null;

export function getConnection(): Connection {
  if (!cachedConnection) {
    cachedConnection = createConnection(env.HELIUS_RPC_URL);
  }
  return cachedConnection;
}

export function getTreasury(): Keypair {
  if (!cachedTreasury) {
    cachedTreasury = keypairFromSecret(env.TREASURY_SECRET_KEY);
  }
  return cachedTreasury;
}

export function getStablecoinMint(): PublicKey {
  if (!cachedMint) {
    cachedMint = new PublicKey(env.STABLECOIN_MINT);
  }
  return cachedMint;
}
