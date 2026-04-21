// Stage 3 regression — same e2e merchant as before, now using
// `@payrail/merchant-sdk` (real Express middleware) instead of hand-rolling
// the X402PaymentHandler dance inline. Behaviour must be identical.
//
//   pnpm stage1:merchant     (blocks; Ctrl-C to stop)
//
// Expects scripts/devnet-wallets/merchant.json from `pnpm stage1:setup`.

import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import express from "express";
import { Keypair } from "@solana/web3.js";
import { payrail } from "@payrail/merchant-sdk";

const PORT = Number(process.env.STAGE1_MERCHANT_PORT ?? 3001);
const RPC = process.env.HELIUS_RPC_URL ?? "https://api.devnet.solana.com";
const MINT =
  process.env.STABLECOIN_MINT ??
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const DECIMALS = Number(process.env.STABLECOIN_DECIMALS ?? 6);

const merchantPath = path.resolve("scripts/devnet-wallets/merchant.json");
if (!fs.existsSync(merchantPath)) {
  console.error(`❌ ${merchantPath} missing. Run: pnpm stage1:setup`);
  process.exit(1);
}
const merchant = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(fs.readFileSync(merchantPath, "utf8")) as number[]),
);

const pay = payrail({
  payoutWallet: merchant.publicKey.toBase58(),
  network: "solana-devnet",
  mint: MINT,
  decimals: DECIMALS,
  rpcUrl: RPC,
});

const app = express();

app.get(
  "/article/:id",
  pay.charge({ amount: "10000", description: "Demo news article" }),
  (req, res) => {
    const settlement = (res.locals as { payrailSettlement?: { transaction: string } })
      .payrailSettlement;
    console.log(
      `   ✓ settled · sig=${settlement?.transaction?.slice(0, 12) ?? "?"}…`,
    );
    res.json({
      id: req.params.id,
      headline: `Dummy article #${req.params.id}`,
      body: "Lorem ipsum dolor sit amet…",
      settledSig: settlement?.transaction ?? null,
    });
  },
);

app.listen(PORT, () => {
  console.log("🛍️  Stage-1 merchant (via @payrail/merchant-sdk)\n");
  console.log(`   URL:            http://localhost:${PORT}/article/:id`);
  console.log(`   Payout wallet:  ${merchant.publicKey.toBase58()}`);
  console.log(`   Network:        solana-devnet`);
  console.log(`   Price:          0.01 USDC (${MINT})`);
  console.log(`   Facilitator:    PayAI (free tier devnet)\n`);
  console.log("Waiting for requests… (Ctrl-C to stop)");
});
