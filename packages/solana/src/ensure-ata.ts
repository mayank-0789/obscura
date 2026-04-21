import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

export type EnsureAtaInput = {
  connection: Connection;
  // Keypair that signs and funds the ~0.002 SOL rent. Usually the treasury.
  payer: Keypair;
  // Wallet that will own the ATA (e.g. a merchant's payout wallet).
  owner: PublicKey;
  mint: PublicKey;
};

export type EnsureAtaResult = {
  ata: PublicKey;
  // Null when the ATA already existed; otherwise the signature that created it.
  signature: string | null;
};

// Opens `owner`'s associated token account for `mint` if it doesn't already
// exist. Transfers ZERO tokens — this is purely an account-initialisation
// call so future inbound transfers don't fail with "destination ATA missing."
//
// `payer` covers the rent (~0.002 SOL) and is the fee payer for the tx.
// Idempotent at two layers: (1) we pre-check with getAccountInfo and skip
// the tx entirely if the ATA exists, (2) the instruction itself is the
// `Idempotent` variant, so a concurrent create from elsewhere won't fail us.
export async function ensureAta(
  input: EnsureAtaInput,
): Promise<EnsureAtaResult> {
  const ata = await getAssociatedTokenAddress(input.mint, input.owner, false);
  const existing = await input.connection.getAccountInfo(ata, "confirmed");
  if (existing) return { ata, signature: null };

  const ix = createAssociatedTokenAccountIdempotentInstruction(
    input.payer.publicKey,
    ata,
    input.owner,
    input.mint,
  );
  const tx = new Transaction().add(ix);
  const { blockhash } = await input.connection.getLatestBlockhash("confirmed");
  tx.feePayer = input.payer.publicKey;
  tx.recentBlockhash = blockhash;
  tx.sign(input.payer);
  const signature = await input.connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
  });
  await input.connection.confirmTransaction(signature, "confirmed");
  return { ata, signature };
}
