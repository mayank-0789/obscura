import { Keypair } from "@solana/web3.js";

// Parse a Solana secret key string into a Keypair.
//
// Accepted formats:
//   - JSON array "[12,34,...,89]" — what `solana-keygen new` writes to disk.
//     This is our default: we paste the contents of the keygen .json file
//     directly into the TREASURY_SECRET_KEY env var.
//
// We deliberately don't support base58 strings yet — adding that would pull in
// a bs58 dep for one rare input format. Add when a real use case shows up.
export function keypairFromSecret(secret: string): Keypair {
  const trimmed = secret.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    throw new Error(
      "keypairFromSecret: expected a JSON array of 64 numbers (solana-keygen format)",
    );
  }

  let bytes: unknown;
  try {
    bytes = JSON.parse(trimmed);
  } catch {
    throw new Error("keypairFromSecret: JSON.parse failed");
  }

  if (
    !Array.isArray(bytes) ||
    bytes.length !== 64 ||
    !bytes.every((n) => typeof n === "number" && n >= 0 && n < 256)
  ) {
    throw new Error(
      "keypairFromSecret: expected exactly 64 numbers in range [0, 255]",
    );
  }

  return Keypair.fromSecretKey(new Uint8Array(bytes as number[]));
}
