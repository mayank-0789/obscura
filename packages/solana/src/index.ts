export { createConnection } from "./connection";
export { keypairFromSecret } from "./treasury";
export {
  transferSpl,
  TransferAlreadyLanded,
  TransferNeverLanded,
  type TransferSplInput,
  type TransferSplResult,
} from "./transfer";
export {
  ensureAta,
  type EnsureAtaInput,
  type EnsureAtaResult,
} from "./ensure-ata";

// Re-export the web3.js and spl-token bits apps commonly need so consumers
// can do `import { PublicKey, Connection } from "@payrail/solana"` instead of
// adding @solana/* as a direct dep.
export { PublicKey, Keypair, Connection } from "@solana/web3.js";
export type { Commitment } from "@solana/web3.js";
export { getAssociatedTokenAddress } from "@solana/spl-token";
