// Stage 1e — Minimal x402 client signing with a local keypair.
// Uses x402-solana/client directly — the wallet adapter holds the
// Keypair in-process and signs synchronously.
//
// This proves the x402 protocol + PayAI facilitator + our devnet setup
// all work before we swap in Privy remote signing in Stage 2.
//
//   pnpm stage1:client

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Keypair, type VersionedTransaction } from "@solana/web3.js";
import {
  createX402Client,
  type WalletAdapter,
} from "x402-solana/client";

const RPC = process.env.HELIUS_RPC_URL ?? "https://api.devnet.solana.com";
const MERCHANT_URL =
  process.env.STAGE1_MERCHANT_URL ?? "http://localhost:3001";
const ARTICLE_ID = process.env.STAGE1_ARTICLE_ID ?? "42";

const testPath = path.resolve("scripts/devnet-wallets/test.json");
if (!fs.existsSync(testPath)) {
  console.error(`❌ ${testPath} missing. Run: pnpm stage1:setup && pnpm stage1:fund`);
  process.exit(1);
}
const kp = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(testPath, "utf8")) as number[]),
);

// WalletAdapter: minimum interface the x402-solana client needs. Our Keypair
// signs in-process — no RPC round-trip, no async delegation. This is the
// baseline we'll replace with Privy remote signing in Stage 2.
const wallet: WalletAdapter = {
  publicKey: kp.publicKey,
  signTransaction: async (tx: VersionedTransaction) => {
    tx.sign([kp]);
    return tx;
  },
};

async function main() {
  const url = `${MERCHANT_URL}/article/${ARTICLE_ID}`;
  console.log("🧑‍💻 Stage-1 client\n");
  console.log(`   Wallet:      ${kp.publicKey.toBase58()}`);
  console.log(`   Target URL:  ${url}`);
  console.log(`   RPC:         ${RPC}\n`);

  const client = createX402Client({
    wallet,
    network: "solana-devnet",
    rpcUrl: RPC,
    verbose: true,
  });

  console.log("→ GET (expecting 402, then auto-paid retry)…\n");
  const t0 = Date.now();
  const res = await client.fetch(url);
  const elapsed = Date.now() - t0;

  console.log(`\n← ${res.status} in ${elapsed}ms`);
  const body = await res.json();
  console.log("   Body:", JSON.stringify(body, null, 2));

  const xPaymentResp = res.headers.get("x-payment-response");
  if (xPaymentResp) {
    const decoded = JSON.parse(Buffer.from(xPaymentResp, "base64").toString());
    console.log(`   Settled tx:  ${decoded.transaction}`);
    console.log(
      `   Solscan:     https://solscan.io/tx/${decoded.transaction}?cluster=devnet`,
    );
  }

  if (res.status !== 200) {
    console.error("\n❌ Non-200 response — Stage 1 is red.");
    process.exit(1);
  }
  console.log("\n✅ Stage 1 green light");
  console.log(
    "   • 402 → signed payment → 200 round-trip works end-to-end",
  );
  console.log(
    "   • PayAI devnet facilitator verified + settled a real SPL transfer",
  );
  console.log("   • Solscan link above shows the on-chain tx");
}

main().catch((e) => {
  console.error("\n❌ Client threw:", e);
  process.exit(1);
});
