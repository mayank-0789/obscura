// Regression harness for Privy delegated-signing configuration.
//
// Creates four test wallets with different signer bindings and attempts a
// Solana sign against each. Variants A and B INTENTIONALLY use the
// deprecated `authorizationKeyIds` parameter to demonstrate that it does not
// enable `signTransaction` (documented in project_privy_delegated_signing.md).
// Only variants C and D — using `additionalSigners: [{ signerId }]` — succeed.
//
// Keep this script. If Privy's API changes such that our production pattern
// regresses, this is the fastest way to pinpoint which parameter shape still
// works. Run: `pnpm spike:privy-variants`.

import "dotenv/config";
import { PrivyClient } from "@privy-io/server-auth";
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

const APP_ID = process.env.PRIVY_APP_ID!;
const APP_SECRET = process.env.PRIVY_APP_SECRET!;
const AUTH_KEY = process.env.PRIVY_AUTHORIZATION_KEY!;
const AUTH_KEY_ID = process.env.PRIVY_AUTHORIZATION_KEY_ID!;
const RPC = process.env.HELIUS_RPC_URL ?? "https://api.devnet.solana.com";

if (!APP_ID || !APP_SECRET || !AUTH_KEY || !AUTH_KEY_ID) {
  console.error("Missing env. Need APP_ID, APP_SECRET, AUTH_KEY, AUTH_KEY_ID.");
  process.exit(1);
}

const privy = new PrivyClient(APP_ID, APP_SECRET, {
  walletApi: { authorizationPrivateKey: AUTH_KEY },
});
const connection = new Connection(RPC, "confirmed");

type Variant = {
  label: string;
  create: (userId: string) => Promise<{ id: string; address: string }>;
};

const variants: Variant[] = [
  {
    label: "A · owner=userId, authorizationKeyIds=[key]",
    create: async (userId) =>
      privy.walletApi.createWallet({
        chainType: "solana",
        owner: { userId },
        authorizationKeyIds: [AUTH_KEY_ID],
        authorizationThreshold: 1,
      }),
  },
  {
    label: "B · NO owner, authorizationKeyIds=[key]",
    create: async () =>
      privy.walletApi.createWallet({
        chainType: "solana",
        authorizationKeyIds: [AUTH_KEY_ID],
        authorizationThreshold: 1,
      }),
  },
  {
    label: "C · owner=userId, additionalSigners=[{signerId:key}]",
    create: async (userId) =>
      privy.walletApi.createWallet({
        chainType: "solana",
        owner: { userId },
        additionalSigners: [{ signerId: AUTH_KEY_ID }],
      }),
  },
  {
    label: "D · NO owner, additionalSigners=[{signerId:key}]",
    create: async () =>
      privy.walletApi.createWallet({
        chainType: "solana",
        additionalSigners: [{ signerId: AUTH_KEY_ID }],
      }),
  },
];

async function signOn(walletId: string, address: string) {
  const pk = new PublicKey(address);
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const msg = new TransactionMessage({
    payerKey: pk,
    recentBlockhash: blockhash,
    instructions: [
      SystemProgram.transfer({ fromPubkey: pk, toPubkey: pk, lamports: 0 }),
    ],
  }).compileToV0Message();
  const tx = new VersionedTransaction(msg);
  const res = await privy.walletApi.solana.signTransaction({
    walletId,
    transaction: tx,
  });
  return res.signedTransaction;
}

async function main() {
  console.log("🔬 Privy wallet-config matrix\n");
  const sharedUser = await privy.importUser({
    linkedAccounts: [
      { type: "email", address: `matrix-${Date.now()}@payrail.test` },
    ],
  });
  console.log(`Shared user: ${sharedUser.id}\n`);

  for (const v of variants) {
    console.log(`── Variant ${v.label}`);
    try {
      const wallet = await v.create(sharedUser.id);
      const full = await privy.walletApi.getWallet({ id: wallet.id });
      console.log(
        `   created walletId=${wallet.id}, ownerId=${full.ownerId}, additionalSigners=${JSON.stringify(full.additionalSigners)}`,
      );
      try {
        await signOn(wallet.id, wallet.address);
        console.log(`   ✓ SIGN SUCCEEDED\n`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const status = (e as { status?: number })?.status ?? "?";
        console.log(`   ✗ sign failed (status=${status}): ${msg}\n`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const status = (e as { status?: number })?.status ?? "?";
      console.log(`   ✗ create failed (status=${status}): ${msg}\n`);
    }
  }
}

main().catch((e) => {
  console.error("\nFatal:", e);
  process.exit(1);
});
