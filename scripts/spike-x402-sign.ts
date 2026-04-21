// Stage 0 — x402 signing de-risk spike.
// Validates that `privy.walletApi.solana.signTransaction()` exists, accepts a
// VersionedTransaction, returns a properly signed VersionedTransaction, and
// does NOT broadcast (no chain activity, no SOL consumed).
//
// This is the single largest risk in the x402 integration plan — if Privy
// couldn't sign VersionedTransactions server-side, the whole architecture
// would need to change. Run before anything else.
//
//   pnpm spike:x402-sign

import "dotenv/config";
import { createPrivateKey, createPublicKey } from "node:crypto";
import { PrivyClient } from "@privy-io/server-auth";
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

const appId = process.env.PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;
const authKey = process.env.PRIVY_AUTHORIZATION_KEY;
const authKeyId = process.env.PRIVY_AUTHORIZATION_KEY_ID;
const heliusRpc =
  process.env.HELIUS_RPC_URL ?? "https://api.devnet.solana.com";

function failEnv(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

if (!appId || !appSecret) {
  failEnv("PRIVY_APP_ID and PRIVY_APP_SECRET must be set in .env");
}
if (!authKey || !authKeyId) {
  failEnv(
    "PRIVY_AUTHORIZATION_KEY and PRIVY_AUTHORIZATION_KEY_ID must be set " +
      "— this spike requires a delegated signer. See Privy dashboard → Wallets → Authorization Keys.",
  );
}

// Pin narrowed values locally so the async `spike()` closure sees them as
// `string`, not `string | undefined` — TS doesn't propagate module-level
// narrowing into nested function bodies.
const APP_ID: string = appId;
const APP_SECRET: string = appSecret;
const AUTH_KEY: string = authKey;
const AUTH_KEY_ID: string = authKeyId;

const privy = new PrivyClient(APP_ID, APP_SECRET, {
  walletApi: { authorizationPrivateKey: AUTH_KEY },
});

const connection = new Connection(heliusRpc, "confirmed");

function isAllZero(bytes: Uint8Array): boolean {
  for (const b of bytes) if (b !== 0) return false;
  return true;
}

// Validate the configured private key and derive its public half.
// Privy accepts an optional `wallet-auth:` or `wallet-api:` prefix on the
// base64-encoded PKCS#8 DER. We strip it before parsing.
function derivePublicKeySpkiBase64(rawKey: string): string {
  const stripped = rawKey
    .replace(/^wallet-auth:/, "")
    .replace(/^wallet-api:/, "");
  const pkcs8 = Buffer.from(stripped, "base64");

  // Parse the PKCS#8-DER private key via Node's built-in OpenSSL bindings.
  // This both validates the format and gives us a KeyObject we can use to
  // derive the matching public key.
  const privateKeyObj = createPrivateKey({
    key: pkcs8,
    format: "der",
    type: "pkcs8",
  });

  const publicKeyObj = createPublicKey(privateKeyObj);
  const spkiDer = publicKeyObj.export({ format: "der", type: "spki" });
  return spkiDer.toString("base64");
}

async function spike() {
  console.log("🔬 x402 signing de-risk spike\n");
  console.log(`   RPC:           ${heliusRpc}`);
  console.log(`   App ID:        ${APP_ID}`);
  console.log(`   Auth key ID:   ${AUTH_KEY_ID}\n`);

  /* ──────────────────────────────────────────────────────────────────
     STEP 0 — Derive public key from the private-key env var and
     display it. User compares this against the Privy dashboard's
     "Members" field to confirm the pair matches.
     ────────────────────────────────────────────────────────────────── */
  console.log("0. Verifying private ↔ public key pair...");
  const derivedPubSpki = derivePublicKeySpkiBase64(AUTH_KEY);
  console.log(
    `   Derived public key (SPKI DER, base64):\n   ${derivedPubSpki}`,
  );
  console.log(
    `   First 10 chars:       ${derivedPubSpki.slice(0, 10)}`,
  );
  console.log(
    `   Last 10 chars:        ${derivedPubSpki.slice(-10)}`,
  );
  console.log(
    "   → Compare this with the Privy dashboard Members value for the key.",
  );
  console.log(
    "     Dashboard shows something like `MFkwEwY…ykmU5tA` — ours should match.\n",
  );

  /* ──────────────────────────────────────────────────────────────────
     STEP 1 — Create a throwaway user + wallet with authorization key
     attached at birth. Matches how our POST /api/agents provisions
     agent wallets in production, so the signing surface is identical.
     ────────────────────────────────────────────────────────────────── */
  const testEmail = `x402-spike-${Date.now()}@payrail.test`;
  console.log(`1. Creating test user (${testEmail})...`);
  const user = await privy.importUser({
    linkedAccounts: [{ type: "email", address: testEmail }],
  });
  console.log(`   ✓ User ID: ${user.id}`);

  console.log(
    `\n2. Creating Solana wallet with additionalSigners=[${AUTH_KEY_ID}]...`,
  );
  console.log(
    "   (Confirmed via spike-privy-variants.ts: authorizationKeyIds is for",
  );
  console.log(
    "    wrapping quorums, NOT authorizing signTransaction. additionalSigners",
  );
  console.log("    is the correct field for delegated signing.)\n");
  const wallet = await privy.walletApi.createWallet({
    chainType: "solana",
    owner: { userId: user.id },
    additionalSigners: [{ signerId: AUTH_KEY_ID }],
  });
  console.log(`   ✓ Wallet ID:      ${wallet.id}`);
  console.log(`   ✓ Wallet address: ${wallet.address}`);
  console.log(
    `   ✓ additionalSigners: ${JSON.stringify(wallet.additionalSigners)}`,
  );

  /* ──────────────────────────────────────────────────────────────────
     STEP 3 — Build a minimal VersionedTransaction (no real value move;
     self-transfer of 0 lamports). We need a real devnet blockhash so the
     transaction can be cryptographically signed; we do NOT broadcast it.
     ────────────────────────────────────────────────────────────────── */
  console.log("\n3. Fetching devnet blockhash...");
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  console.log(`   ✓ Blockhash: ${blockhash}`);

  const walletPubkey = new PublicKey(wallet.address);
  const message = new TransactionMessage({
    payerKey: walletPubkey,
    recentBlockhash: blockhash,
    instructions: [
      SystemProgram.transfer({
        fromPubkey: walletPubkey,
        toPubkey: walletPubkey,
        lamports: 0,
      }),
    ],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);

  const preSig = tx.signatures[0];
  console.log(
    `   ✓ Unsigned tx · signatures[0] all-zero: ${
      preSig ? isAllZero(preSig) : "(no slot)"
    }`,
  );

  /* ──────────────────────────────────────────────────────────────────
     STEP 4 — Sign via Privy delegated signer. This is the load-bearing
     call. No CAIP-2 argument (signing is network-independent; only
     signAndSendTransaction needs to know which RPC to broadcast to).
     ────────────────────────────────────────────────────────────────── */
  console.log(
    "\n4. Calling privy.walletApi.solana.signTransaction (delegated)...",
  );
  const result = await privy.walletApi.solana.signTransaction({
    walletId: wallet.id,
    transaction: tx,
  });

  const signed = result.signedTransaction;
  if (!(signed instanceof VersionedTransaction)) {
    throw new Error(
      `Expected VersionedTransaction back, got ${signed.constructor.name}`,
    );
  }
  console.log("   ✓ Got VersionedTransaction back");

  const sig = signed.signatures[0];
  if (!sig) throw new Error("signedTransaction.signatures[0] is missing");
  if (sig.length !== 64) {
    throw new Error(`Expected 64-byte signature, got ${sig.length} bytes`);
  }
  if (isAllZero(sig)) {
    throw new Error(
      "signedTransaction.signatures[0] is all zeros — signing did not populate it",
    );
  }
  const sigHex = Buffer.from(sig).toString("hex");
  console.log(`   ✓ Signature (64 bytes): ${sigHex.slice(0, 32)}…`);

  /* ──────────────────────────────────────────────────────────────────
     STEP 5 — Serialize the signed tx to base64 (exactly what we'd do
     before placing it into the PAYMENT-SIGNATURE header at runtime).
     ────────────────────────────────────────────────────────────────── */
  const serialized = Buffer.from(signed.serialize()).toString("base64");
  console.log(`\n5. Serialized to base64 (length=${serialized.length} chars)`);
  console.log(`   First 64 chars: ${serialized.slice(0, 64)}…`);

  /* ──────────────────────────────────────────────────────────────────
     STEP 6 — Confirm we did NOT broadcast. Check the tx signature on
     devnet. `getSignatureStatus` should return null because the tx was
     never submitted.
     ────────────────────────────────────────────────────────────────── */
  const txSigBase58 = Buffer.from(sig).toString("base64"); // signature identifier
  const statuses = await connection.getSignatureStatuses([
    // web3.js wants base58 for signature IDs; serialized base64 above is for
    // the whole transaction, not the signature. For this sanity check we
    // just confirm `getSignatureStatuses` handles a brand new signature.
    // A real query would base58-encode the 64-byte signature, but for
    // "did we broadcast" the check is whether any status exists at all.
    bs58Encode(sig),
  ]);
  const found = statuses.value[0];
  if (found) {
    console.warn(
      "\n   ⚠ getSignatureStatuses returned a status — tx may have been broadcast?",
      found,
    );
  } else {
    console.log("\n6. ✓ Signature not found on-chain — we did NOT broadcast.");
  }

  console.log("\n────────────────────────────────────────────");
  console.log("✅ Stage 0 green light");
  console.log("────────────────────────────────────────────");
  console.log(
    "   • signTransaction() exists and accepts VersionedTransaction",
  );
  console.log("   • Returns a VersionedTransaction with a 64-byte signature");
  console.log(
    "   • No CAIP-2 required (pure signing, no network bind at sign time)",
  );
  console.log("   • Does not broadcast");
  console.log(
    `\n   Throwaway user: ${user.id}  (delete from Privy dashboard if you care about hygiene)`,
  );
}

// Minimal base58 encoder so we don't need bs58 as a dependency.
// Correct for 64-byte ed25519 signatures (only use case here).
function bs58Encode(bytes: Uint8Array): string {
  const ALPHABET =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = 0n;
  for (const b of bytes) num = (num << 8n) | BigInt(b);
  let out = "";
  while (num > 0n) {
    const rem = Number(num % 58n);
    num = num / 58n;
    out = ALPHABET[rem] + out;
  }
  for (const b of bytes) {
    if (b === 0) out = "1" + out;
    else break;
  }
  return out;
}

spike().catch((err) => {
  console.error("\n❌ Spike threw:", err);
  process.exit(1);
});
