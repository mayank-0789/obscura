export { createConnection } from "./connection";
export { keypairFromSecret } from "./treasury";

// Re-export the web3.js bits apps commonly need so consumers can do
// `import { PublicKey, Connection } from "@obscura-app/solana"` instead of
// adding @solana/web3.js as a direct dep.
export { PublicKey, Keypair, Connection } from "@solana/web3.js";
export type { Commitment } from "@solana/web3.js";
