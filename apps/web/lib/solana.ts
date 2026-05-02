import "server-only";
import {
  createConnection,
  keypairFromSecret,
  PublicKey,
  type Connection,
  type Keypair,
} from "@obscura-app/solana";
import { env } from "@/lib/env";

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
