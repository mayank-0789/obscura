// Stage 2.5 — Provision a fresh test agent end-to-end:
//   1. Look up (or import) a throwaway Privy user
//   2. Create a Solana wallet with the correct additionalSigners binding
//   3. Insert agents + budgets + agent_api_keys rows matching production shape
//   4. Fund the wallet from the treasury (SOL for rent + USDC to spend)
//   5. Print the plaintext API key ONCE for the tester to export
//
// This bypasses the browser + Dodo so Stage 2 has a known-good subject for
// `pnpm stage2:client`. Uses the SAME createWallet params as the fixed
// POST /api/agents route, so any regression here will also break production.
//
//   pnpm stage2:provision-agent
//
// Creates a new agent every run — safe to rerun.

import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { customAlphabet } from "nanoid";
import { neon } from "@neondatabase/serverless";
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
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
} from "@solana/spl-token";
import { PrivyClient } from "@privy-io/server-auth";

const required = [
  "DATABASE_URL",
  "PRIVY_APP_ID",
  "PRIVY_APP_SECRET",
  "PRIVY_AUTHORIZATION_KEY",
  "PRIVY_AUTHORIZATION_KEY_ID",
  "HELIUS_RPC_URL",
  "TREASURY_SECRET_KEY",
  "STABLECOIN_MINT",
] as const;
for (const k of required) {
  if (!process.env[k]) {
    console.error(`❌ env ${k} missing`);
    process.exit(1);
  }
}

const DATABASE_URL = process.env.DATABASE_URL!;
const APP_ID = process.env.PRIVY_APP_ID!;
const APP_SECRET = process.env.PRIVY_APP_SECRET!;
const AUTH_KEY = process.env.PRIVY_AUTHORIZATION_KEY!;
const AUTH_KEY_ID = process.env.PRIVY_AUTHORIZATION_KEY_ID!;
const HELIUS = process.env.HELIUS_RPC_URL!;
const TREASURY_SECRET = process.env.TREASURY_SECRET_KEY!;
const MINT_ADDRESS = process.env.STABLECOIN_MINT!;
const DECIMALS = Number(process.env.STABLECOIN_DECIMALS ?? 6);
const FUND_USDC = 1_000_000n; // 1 USDC
const FUND_SOL_LAMPORTS = 0.01 * LAMPORTS_PER_SOL;

const sql = neon(DATABASE_URL);
const privy = new PrivyClient(APP_ID, APP_SECRET, {
  walletApi: { authorizationPrivateKey: AUTH_KEY },
});
const connection = new Connection(HELIUS, "confirmed");
const treasury = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(TREASURY_SECRET) as number[]),
);
const mint = new PublicKey(MINT_ADDRESS);

const KEY_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const nanoId = customAlphabet(KEY_ALPHABET, 28);

function generateApiKey(): { plaintext: string; hash: string } {
  const plaintext = `pk_${nanoId()}`;
  const hash = createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, hash };
}

// INR → USDG (6 decimals) at ₹85 per USDC. Mirrors lib/rates.ts.
function quoteInrToUsdg(paise: bigint): { usdg: bigint; rateInr: number } {
  const rateInr = 85;
  const usdg = (paise * 10n ** BigInt(DECIMALS)) / (BigInt(rateInr) * 100n);
  return { usdg, rateInr };
}

async function getOrCreateUser(email: string): Promise<{
  dbId: string;
  privyId: string;
}> {
  const existing = (await sql`
    SELECT id, privy_id FROM users WHERE email = ${email} LIMIT 1
  `) as Array<{ id: string; privy_id: string }>;

  if (existing[0]) {
    const row = existing[0];
    return { dbId: row.id, privyId: row.privy_id };
  }

  const privyUser = await privy.importUser({
    linkedAccounts: [{ type: "email", address: email }],
  });
  const inserted = (await sql`
    INSERT INTO users (privy_id, email, role)
    VALUES (${privyUser.id}, ${email}, 'user')
    RETURNING id, privy_id
  `) as Array<{ id: string; privy_id: string }>;
  const user = inserted[0];
  if (!user) throw new Error("user insert returned no rows");
  return { dbId: user.id, privyId: user.privy_id };
}

async function fundAgentWallet(walletPubkey: PublicKey): Promise<void> {
  // SOL for ATA rent + anything else the agent will need.
  const solBalance = await connection.getBalance(walletPubkey);
  if (solBalance < FUND_SOL_LAMPORTS) {
    console.log(
      `   • sending ${(FUND_SOL_LAMPORTS / LAMPORTS_PER_SOL).toFixed(3)} SOL…`,
    );
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: treasury.publicKey,
        toPubkey: walletPubkey,
        lamports: FUND_SOL_LAMPORTS,
      }),
    );
    const sig = await sendAndConfirmTransaction(connection, tx, [treasury]);
    console.log(`     sig: ${sig}`);
  }

  // USDC ATA + balance.
  const treasuryAta = await getAssociatedTokenAddress(mint, treasury.publicKey);
  const agentAta = await getOrCreateAssociatedTokenAccount(
    connection,
    treasury,
    mint,
    walletPubkey,
  );
  const agentBal = await getAccount(connection, agentAta.address);
  if (agentBal.amount >= FUND_USDC) {
    console.log(
      `   • USDC balance ${Number(agentBal.amount) / 10 ** DECIMALS} (target met)`,
    );
    return;
  }
  const delta = FUND_USDC - agentBal.amount;
  console.log(
    `   • sending ${Number(delta) / 10 ** DECIMALS} USDC from treasury…`,
  );
  const tx = new Transaction().add(
    createTransferCheckedInstruction(
      treasuryAta,
      mint,
      agentAta.address,
      treasury.publicKey,
      delta,
      DECIMALS,
    ),
  );
  const sig = await sendAndConfirmTransaction(connection, tx, [treasury]);
  console.log(`     sig: ${sig}`);
}

async function main() {
  console.log("🛠  Stage-2 provision agent\n");

  // 1. User (reuse a stable throwaway)
  const email = "stage2-test@payrail.test";
  console.log(`1. User: ${email}`);
  const user = await getOrCreateUser(email);
  console.log(`   db_id=${user.dbId}  privy_id=${user.privyId}`);

  // 2. Privy wallet — THE fix: additionalSigners, NOT authorizationKeyIds.
  console.log("\n2. Creating Solana wallet with additionalSigners…");
  const wallet = await privy.walletApi.createWallet({
    chainType: "solana",
    owner: { userId: user.privyId },
    additionalSigners: [{ signerId: AUTH_KEY_ID }],
  });
  console.log(`   wallet_id=${wallet.id}`);
  console.log(`   address=${wallet.address}`);

  // 3. DB rows — agents + budgets + agent_api_keys (batch via a single SQL txn).
  console.log("\n3. Inserting agents + budgets + agent_api_keys…");
  const agentId = randomUUID();
  const budgetId = randomUUID();
  const apiKeyId = randomUUID();
  const apiKey = generateApiKey();

  // Cap: ₹500 → converted via the same quote as production.
  const capInrPaise = 500n * 100n;
  const { usdg: capUsdg } = quoteInrToUsdg(capInrPaise);
  const name = `Stage 2 test · ${new Date().toISOString().slice(0, 19)}`;

  // neon-http doesn't expose multi-statement transactions; each sql`` call is
  // its own statement. For a 3-insert sequence this is acceptable — worst
  // case on partial failure is an orphan agents row we reconcile manually.
  await sql`
    INSERT INTO agents (id, user_id, name, privy_wallet_id, public_key, status)
    VALUES (${agentId}, ${user.dbId}, ${name}, ${wallet.id}, ${wallet.address}, 'active')
  `;
  await sql`
    INSERT INTO budgets (id, agent_id, period, cap_inr, cap_usdg, spent_usdg)
    VALUES (${budgetId}, ${agentId}, 'monthly', ${capInrPaise.toString()}, ${capUsdg.toString()}, 0)
  `;
  await sql`
    INSERT INTO agent_api_keys (id, agent_id, key_hash, label)
    VALUES (${apiKeyId}, ${agentId}, ${apiKey.hash}, 'stage2 provisioning')
  `;
  console.log(
    `   agent=${agentId}\n   budget=${budgetId} · cap=${capInrPaise / 100n} INR ≈ ${Number(capUsdg) / 10 ** DECIMALS} USDC`,
  );

  // 4. Fund the wallet from treasury (bypassing Dodo).
  console.log("\n4. Funding agent wallet from treasury…");
  await fundAgentWallet(new PublicKey(wallet.address));

  // 5. Done — print the API key (only chance to see it).
  console.log("\n────────────────────────────────────────────");
  console.log("✅ Stage 2 subject ready");
  console.log("────────────────────────────────────────────");
  console.log(`\n   agent id:     ${agentId}`);
  console.log(`   wallet:       ${wallet.address}`);
  console.log(`   API key:      ${apiKey.plaintext}`);
  console.log("\n   Next:");
  console.log(`     export STAGE2_AGENT_API_KEY=${apiKey.plaintext}`);
  console.log(`     pnpm stage1:merchant       # in another terminal`);
  console.log(`     pnpm stage2:client`);
}

main().catch((err) => {
  console.error("\n❌ provisioning threw:", err);
  process.exit(1);
});
