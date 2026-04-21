// Stage 1c — Fund the test + merchant wallets from the treasury for the
// local-keypair round-trip. Uses the treasury keypair already in .env.
//
//   pnpm stage1:fund
//
// What it does:
//   1. Sends SOL to test + merchant wallets (for ATA rent).
//   2. Ensures treasury has a USDC ATA.
//   3. Creates USDC ATA for test + merchant wallets.
//   4. Transfers 1 USDC from treasury → test wallet (enough for many $0.01 calls).
//
// Idempotent — safe to re-run. Skips steps already satisfied.

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
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
  getAccount,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  createTransferCheckedInstruction,
} from "@solana/spl-token";

const RPC =
  process.env.HELIUS_RPC_URL ?? "https://api.devnet.solana.com";
const TREASURY_SECRET = process.env.TREASURY_SECRET_KEY;
const MINT_ADDRESS =
  process.env.STABLECOIN_MINT ??
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"; // canonical devnet USDC
const DECIMALS = Number(process.env.STABLECOIN_DECIMALS ?? 6);

if (!TREASURY_SECRET) {
  console.error("❌ TREASURY_SECRET_KEY must be set in .env");
  process.exit(1);
}

const connection = new Connection(RPC, "confirmed");
const treasury = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(TREASURY_SECRET) as number[]),
);

const WALLETS_DIR = path.resolve("scripts/devnet-wallets");
function loadKeypair(name: string): Keypair {
  const p = path.join(WALLETS_DIR, name);
  if (!fs.existsSync(p)) {
    console.error(`❌ ${p} not found. Run: pnpm stage1:setup first.`);
    process.exit(1);
  }
  const bytes = JSON.parse(fs.readFileSync(p, "utf8")) as number[];
  return Keypair.fromSecretKey(Uint8Array.from(bytes));
}

const test = loadKeypair("test.json");
const merchant = loadKeypair("merchant.json");
const mint = new PublicKey(MINT_ADDRESS);

const SOL_TARGET_LAMPORTS = 0.05 * LAMPORTS_PER_SOL; // enough for ATA rent
const TEST_USDC_TARGET = 1_000_000n; // 1 USDC (enough for ~100 paid calls at $0.01)

async function ensureSol(
  name: string,
  recipient: PublicKey,
): Promise<void> {
  const balance = await connection.getBalance(recipient);
  if (balance >= SOL_TARGET_LAMPORTS) {
    console.log(
      `• ${name.padEnd(10)} SOL · ${(balance / LAMPORTS_PER_SOL).toFixed(4)} (target met)`,
    );
    return;
  }
  const delta = SOL_TARGET_LAMPORTS - balance;
  console.log(
    `✓ ${name.padEnd(10)} sending ${(delta / LAMPORTS_PER_SOL).toFixed(4)} SOL…`,
  );
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: recipient,
      lamports: delta,
    }),
  );
  const sig = await sendAndConfirmTransaction(connection, tx, [treasury]);
  console.log(`   sig: ${sig}`);
}

async function ensureUsdcAta(name: string, owner: PublicKey): Promise<PublicKey> {
  // getOrCreateAssociatedTokenAccount pays rent from `payer` (treasury) and
  // creates the ATA if missing. Idempotent.
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    treasury,
    mint,
    owner,
  );
  console.log(`• ${name.padEnd(10)} USDC ATA · ${ata.address.toBase58()}`);
  return ata.address;
}

async function usdcBalance(ata: PublicKey): Promise<bigint> {
  try {
    const account = await getAccount(connection, ata);
    return account.amount;
  } catch {
    return 0n;
  }
}

async function main() {
  console.log("💰 Stage 1 funding\n");
  console.log(`   RPC:       ${RPC}`);
  console.log(`   Treasury:  ${treasury.publicKey.toBase58()}`);
  console.log(`   Test:      ${test.publicKey.toBase58()}`);
  console.log(`   Merchant:  ${merchant.publicKey.toBase58()}`);
  console.log(`   Mint:      ${mint.toBase58()} (decimals=${DECIMALS})\n`);

  // Verify treasury itself has resources to fund from.
  const treasurySol = await connection.getBalance(treasury.publicKey);
  console.log(
    `Treasury SOL: ${(treasurySol / LAMPORTS_PER_SOL).toFixed(4)}`,
  );
  if (treasurySol < 0.2 * LAMPORTS_PER_SOL) {
    console.error(
      "\n❌ Treasury has <0.2 SOL — not enough to fund test wallets + ATAs.",
    );
    console.error(
      `   Airdrop via: solana airdrop 2 ${treasury.publicKey.toBase58()} -u devnet`,
    );
    process.exit(1);
  }

  const treasuryAta = await getAssociatedTokenAddress(mint, treasury.publicKey);
  const treasuryUsdc = await usdcBalance(treasuryAta);
  console.log(
    `Treasury USDC: ${Number(treasuryUsdc) / 10 ** DECIMALS} (${treasuryUsdc} atomic)\n`,
  );
  if (treasuryUsdc < TEST_USDC_TARGET) {
    console.error(
      `❌ Treasury has <${Number(TEST_USDC_TARGET) / 10 ** DECIMALS} USDC — not enough to fund test wallet.`,
    );
    console.error(
      `   Get devnet USDC: https://faucet.circle.com/ → address ${treasury.publicKey.toBase58()}`,
    );
    process.exit(1);
  }

  // 1. SOL for gas/rent
  console.log("Step 1 — SOL");
  await ensureSol("test", test.publicKey);
  await ensureSol("merchant", merchant.publicKey);

  // 2. USDC ATAs (both sides must exist before any transfer can succeed)
  console.log("\nStep 2 — USDC ATAs");
  const testAta = await ensureUsdcAta("test", test.publicKey);
  const merchantAta = await ensureUsdcAta("merchant", merchant.publicKey);

  // 3. Top up test wallet with USDC
  console.log("\nStep 3 — USDC balance on test wallet");
  const testUsdc = await usdcBalance(testAta);
  if (testUsdc >= TEST_USDC_TARGET) {
    console.log(
      `• test USDC · ${Number(testUsdc) / 10 ** DECIMALS} (target met)`,
    );
  } else {
    const delta = TEST_USDC_TARGET - testUsdc;
    console.log(
      `✓ test sending ${Number(delta) / 10 ** DECIMALS} USDC from treasury…`,
    );
    const tx = new Transaction().add(
      createTransferCheckedInstruction(
        treasuryAta,
        mint,
        testAta,
        treasury.publicKey,
        delta,
        DECIMALS,
      ),
    );
    const sig = await sendAndConfirmTransaction(connection, tx, [treasury]);
    console.log(`   sig: ${sig}`);
  }

  // 4. Final snapshot
  console.log("\n📊 Final state");
  const testSol = await connection.getBalance(test.publicKey);
  const merchantSol = await connection.getBalance(merchant.publicKey);
  const finalTestUsdc = await usdcBalance(testAta);
  const finalMerchantUsdc = await usdcBalance(merchantAta);
  console.log(
    `   test      · ${(testSol / LAMPORTS_PER_SOL).toFixed(4)} SOL · ${Number(finalTestUsdc) / 10 ** DECIMALS} USDC`,
  );
  console.log(
    `   merchant  · ${(merchantSol / LAMPORTS_PER_SOL).toFixed(4)} SOL · ${Number(finalMerchantUsdc) / 10 ** DECIMALS} USDC`,
  );
  console.log("\n✅ Funding complete. Next: pnpm stage1:merchant");
}

main().catch((e) => {
  console.error("\n❌ Fund script threw:", e);
  process.exit(1);
});
