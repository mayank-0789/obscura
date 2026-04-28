import "dotenv/config";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddress,
  getAccount,
} from "@solana/spl-token";

function parseTreasury(secret: string): Keypair {
  const trimmed = secret.trim();
  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    throw new Error(
      "TREASURY_SECRET_KEY must be a JSON array of 64 numbers (solana-keygen format)",
    );
  }
  const bytes = JSON.parse(trimmed) as number[];
  if (bytes.length !== 64) {
    throw new Error("TREASURY_SECRET_KEY must contain exactly 64 numbers");
  }
  return Keypair.fromSecretKey(new Uint8Array(bytes));
}

async function main() {
  const rpc = process.env.HELIUS_RPC_URL;
  const secret = process.env.TREASURY_SECRET_KEY;
  if (!rpc) throw new Error("HELIUS_RPC_URL not set");
  if (!secret) throw new Error("TREASURY_SECRET_KEY not set");

  const arg = process.argv[2];
  const sol = arg ? Number(arg) : 1;
  if (!Number.isFinite(sol) || sol <= 0) {
    throw new Error(`invalid SOL amount: ${arg}`);
  }
  const lamports = BigInt(Math.round(sol * 1_000_000_000));

  const treasury = parseTreasury(secret);
  const conn = new Connection(rpc, "confirmed");
  const wsolAta = await getAssociatedTokenAddress(
    NATIVE_MINT,
    treasury.publicKey,
    false,
    TOKEN_PROGRAM_ID,
  );

  console.log(`treasury     ${treasury.publicKey.toBase58()}`);
  console.log(`WSOL ATA     ${wsolAta.toBase58()}`);
  console.log(`wrapping     ${sol} SOL (${lamports.toString()} lamports)`);

  const solBalance = await conn.getBalance(treasury.publicKey);
  console.log(`SOL balance  ${(solBalance / 1_000_000_000).toFixed(6)} SOL`);
  if (BigInt(solBalance) < lamports + 5_000_000n) {
    throw new Error(
      `insufficient SOL: need ~${sol + 0.005} SOL (amount + fees + ATA rent), have ${(solBalance / 1_000_000_000).toFixed(6)}`,
    );
  }

  const tx = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      treasury.publicKey,
      wsolAta,
      treasury.publicKey,
      NATIVE_MINT,
    ),
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: wsolAta,
      lamports,
    }),
    createSyncNativeInstruction(wsolAta),
  );

  const sig = await conn.sendTransaction(tx, [treasury], {
    skipPreflight: false,
  });
  console.log(`sent         ${sig}`);
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  await conn.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  const acct = await getAccount(conn, wsolAta);
  console.log(
    `confirmed    WSOL ATA balance now ${(Number(acct.amount) / 1_000_000_000).toFixed(6)} WSOL`,
  );
  const cluster = rpc.includes("devnet") ? "?cluster=devnet" : "";
  console.log(`solscan      https://solscan.io/tx/${sig}${cluster}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
