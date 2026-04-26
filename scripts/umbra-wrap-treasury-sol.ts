import "dotenv/config";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  NATIVE_MINT,
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

// Wrap N SOL of the treasury's native SOL into WSOL (the SPL representation
// of SOL at mint So11111111111111111111111111111111111111112).
//
// Why: Umbra devnet only supports WSOL today (Discord Q3, 2026-04-25). To
// deposit value from treasury into an agent's encrypted account, we need
// SPL-form SOL — which is what WSOL is.
//
// Idempotent on the ATA: if the treasury's WSOL token account already exists,
// the create-instruction no-ops. The wrap itself is additive; calling it
// twice for "5 SOL" produces 10 WSOL (10 SOL of native SOL is consumed, then
// syncNative reflects it). Don't run twice unless you want to wrap more.
//
// Usage:
//   pnpm umbra:wrap-treasury-sol 10        # wrap 10 SOL
//   WRAP_SOL_AMOUNT=10 pnpm umbra:wrap-treasury-sol
//
// Env required:
//   - HELIUS_RPC_URL
//   - TREASURY_SECRET_KEY (JSON array, 64 bytes)

function fromEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`env var ${name} is required`);
  }
  return value;
}

function parseSecret(raw: string): Uint8Array {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("TREASURY_SECRET_KEY must be a JSON array of 64 integers");
  }
  if (!Array.isArray(parsed) || parsed.length !== 64) {
    throw new Error("TREASURY_SECRET_KEY must be exactly 64 bytes");
  }
  return Uint8Array.from(parsed as number[]);
}

async function main() {
  const amountStr = process.argv[2] ?? process.env.WRAP_SOL_AMOUNT ?? "10";
  const amountSol = parseFloat(amountStr);
  if (isNaN(amountSol) || amountSol <= 0) {
    throw new Error(`invalid SOL amount: ${amountStr}`);
  }
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);

  const rpcUrl = fromEnv("HELIUS_RPC_URL");
  const treasuryRaw = fromEnv("TREASURY_SECRET_KEY");
  const treasury = Keypair.fromSecretKey(parseSecret(treasuryRaw));
  const connection = new Connection(rpcUrl, "confirmed");

  console.log(`treasury:        ${treasury.publicKey.toBase58()}`);
  console.log(`wrap amount:     ${amountSol} SOL`);
  console.log(`rpc:             ${rpcUrl.replace(/api-key=[^&]+/, "api-key=…")}`);

  // Sanity check: enough SOL for the wrap + ~0.005 SOL fee buffer.
  const balance = await connection.getBalance(treasury.publicKey);
  const buffer = 5_000_000; // 0.005 SOL
  if (balance < lamports + buffer) {
    throw new Error(
      `insufficient SOL: have ${balance / LAMPORTS_PER_SOL}, need ${(lamports + buffer) / LAMPORTS_PER_SOL}`,
    );
  }
  console.log(`current balance: ${balance / LAMPORTS_PER_SOL} SOL`);

  const ata = getAssociatedTokenAddressSync(NATIVE_MINT, treasury.publicKey);
  console.log(`wsol ata:        ${ata.toBase58()}`);

  // The wrap is three instructions in one tx:
  //   1. Idempotently ensure the treasury's WSOL ATA exists.
  //   2. SystemProgram.transfer SOL into that ATA. The ATA's lamport balance
  //      now exceeds its rent-exempt minimum.
  //   3. syncNative reads the actual lamport balance and updates the SPL
  //      token amount field accordingly.
  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      treasury.publicKey,
      ata,
      treasury.publicKey,
      NATIVE_MINT,
    ),
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: ata,
      lamports,
    }),
    createSyncNativeInstruction(ata),
  );

  console.log(`→ submitting wrap tx...`);
  const sig = await sendAndConfirmTransaction(connection, tx, [treasury]);
  console.log(`✓ wrapped ${amountSol} SOL → WSOL`);
  console.log(`signature:       ${sig}`);

  // Best-effort post-wrap balance read for confirmation.
  try {
    const after = await connection.getTokenAccountBalance(ata);
    console.log(`wsol balance:    ${after.value.uiAmountString} WSOL`);
  } catch {
    /* swallow */
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
