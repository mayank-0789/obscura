// Privy de-risk spike. Validates (1) user+wallet creation, (2) multi-wallet per user,
// (3) delegated signing (requires PRIVY_AUTHORIZATION_KEY). Run: `pnpm spike:privy`.

import "dotenv/config";
import {
  PrivyClient,
  type WalletWithMetadata,
} from "@privy-io/server-auth";
import {
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

const appId = process.env.PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;
const authKey = process.env.PRIVY_AUTHORIZATION_KEY;

if (!appId || !appSecret) {
  console.error(
    "❌ PRIVY_APP_ID and PRIVY_APP_SECRET must be set in .env.local",
  );
  process.exit(1);
}

const privy = new PrivyClient(appId, appSecret, {
  walletApi: authKey
    ? { authorizationPrivateKey: authKey }
    : undefined,
});

function isSolanaWallet(
  account: unknown,
): account is WalletWithMetadata & { chainType: "solana" } {
  if (typeof account !== "object" || account === null) return false;
  const a = account as Partial<WalletWithMetadata>;
  return a.type === "wallet" && a.chainType === "solana";
}

async function spike() {
  console.log("🔬 Privy de-risk spike\n");
  console.log(`   App ID: ${appId}`);
  console.log(
    `   Authorization key: ${authKey ? "set (delegated signing enabled)" : "NOT set (step 3 will be skipped)"}\n`,
  );

  /* ----------------------------------------------------------------------
     STEP 1 — Create a test user with a Solana wallet
     -------------------------------------------------------------------- */
  const testEmail = `spike-${Date.now()}@payrail.test`;
  console.log(`1. Importing test user (${testEmail})...`);

  const user = await privy.importUser({
    linkedAccounts: [{ type: "email", address: testEmail }],
    createSolanaWallet: true,
  });
  console.log(`   ✓ User ID: ${user.id}`);

  const wallet1 = user.linkedAccounts.find(isSolanaWallet);
  if (!wallet1) {
    throw new Error("No Solana wallet returned on importUser");
  }
  console.log(`   ✓ Wallet 1 address: ${wallet1.address}`);

  /* ----------------------------------------------------------------------
     STEP 2 — Create a second Solana wallet for the same user
     -------------------------------------------------------------------- */
  console.log("\n2. Creating second Solana wallet (multi-wallet test)...");
  const wallet2 = await privy.walletApi.createWallet({
    chainType: "solana",
    owner: { userId: user.id },
  });
  console.log(`   ✓ Wallet 2 id: ${wallet2.id}`);
  console.log(`   ✓ Wallet 2 address: ${wallet2.address}`);

  /* ----------------------------------------------------------------------
     STEP 3 — Delegated signing (requires authorization key)
     -------------------------------------------------------------------- */
  if (!authKey) {
    console.log(
      "\n3. SKIPPED — PRIVY_AUTHORIZATION_KEY not set.\n" +
        "   To test delegated signing:\n" +
        "   • Privy dashboard → Wallets → Authorization Keys → Generate\n" +
        "   • Add the PRIVATE half as PRIVY_AUTHORIZATION_KEY in .env.local\n" +
        "   • Re-run this spike.",
    );
  } else {
    console.log("\n3. Testing delegated sign on Wallet 2...");
    const walletPubkey = new PublicKey(wallet2.address);
    const dummyTx = new Transaction({
      feePayer: walletPubkey,
      recentBlockhash: "11111111111111111111111111111111", // Privy fills in
    }).add(
      SystemProgram.transfer({
        fromPubkey: walletPubkey,
        toPubkey: walletPubkey,
        lamports: 0,
      }),
    );

    try {
      const result = await privy.walletApi.solana.signTransaction({
        walletId: wallet2.id,
        transaction: dummyTx,
      });
      const signed = result.signedTransaction;
      if (!signed) {
        throw new Error("No signedTransaction returned");
      }
      console.log("   ✓ Signed without user prompt — delegated signing works");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`   ❌ Sign failed: ${msg}`);
      console.log(
        "   Likely causes:\n" +
          "   • Authorization key not matched to wallet (check dashboard)\n" +
          "   • Key permissions don't include the target chain/method\n" +
          "   • Wallet requires explicit user consent in Privy dashboard settings",
      );
      process.exitCode = 1;
    }
  }

  console.log("\n✅ Spike complete");
  console.log(
    `\n   Test user created: ${user.id}\n   (delete from Privy dashboard after inspection)`,
  );
}

spike().catch((err) => {
  console.error("\n❌ Spike threw:", err);
  process.exit(1);
});
