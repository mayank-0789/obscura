import { Keypair } from "@solana/web3.js";

// Parse a Solana secret key (JSON array format from solana-keygen) into a Keypair.
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
