// Stage 1a — Generate test + merchant keypairs for the local-keypair
// round-trip. Writes JSON arrays of secret-key bytes to
// scripts/devnet-wallets/ (gitignored). Idempotent: keeps existing keypairs
// if they're already there.
//
//   pnpm stage1:setup

import fs from "node:fs";
import path from "node:path";
import { Keypair } from "@solana/web3.js";

const WALLETS_DIR = path.resolve("scripts/devnet-wallets");
fs.mkdirSync(WALLETS_DIR, { recursive: true });

const targets = [
  { file: "test.json", role: "test agent (buyer)" },
  { file: "merchant.json", role: "demo merchant (seller)" },
] as const;

for (const { file, role } of targets) {
  const fullPath = path.join(WALLETS_DIR, file);
  if (fs.existsSync(fullPath)) {
    const bytes = JSON.parse(fs.readFileSync(fullPath, "utf8")) as number[];
    const kp = Keypair.fromSecretKey(Uint8Array.from(bytes));
    console.log(`• ${file.padEnd(14)} exists · ${role} · ${kp.publicKey.toBase58()}`);
    continue;
  }
  const kp = Keypair.generate();
  fs.writeFileSync(fullPath, JSON.stringify(Array.from(kp.secretKey)));
  console.log(`✓ ${file.padEnd(14)} created · ${role} · ${kp.publicKey.toBase58()}`);
}

console.log(`\nWallets written to: ${WALLETS_DIR}`);
console.log("Next: pnpm stage1:fund");
