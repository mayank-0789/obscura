import "dotenv/config";
import { createHmac } from "node:crypto";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  Connection,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createSignerFromPrivateKeyBytes,
  getUmbraClient,
  getUserRegistrationFunction,
} from "@umbra-privacy/sdk";
import { getUserRegistrationProver } from "@umbra-privacy/web-zk-prover";

// Idempotent demo helper: derive the deterministic merchant ETA for a given
// merchant ID, fund it with SOL from treasury, register it on Umbra with
// `{confidential: true, anonymous: true}` (so it can both receive direct
// deposits AND be addressed via the mixer). Print the ETA address at the end
// so you can paste it into apps/demo-merchant-news/.env as
// MERCHANT_ETA_ADDRESS.
//
// Usage:
//   pnpm umbra:bootstrap-merchant <merchantId>
//
// Env required:
//   - HELIUS_RPC_URL
//   - TREASURY_SECRET_KEY (for SOL-funding the new ETA address)
//   - UMBRA_AGENT_SEED_SECRET (HMAC root)
//
// The merchantId can be any string — we derive a deterministic keypair from
// it via HMAC, the same way the production /api/merchants flow will. For
// the demo, a stable id like "demo-news-001" gives a reproducible setup
// across machines (same id → same ETA address).

type UmbraNetwork = "devnet" | "mainnet" | "localnet";

const SUBJECT_SOL_TARGET = 0.05 * LAMPORTS_PER_SOL;

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v || v.trim().length === 0) throw new Error(`env var ${name} is required`);
  return v;
}

function envOptional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim().length > 0 ? v : undefined;
}

function resolveNetwork(): UmbraNetwork {
  const v = (process.env.UMBRA_NETWORK ?? "devnet") as UmbraNetwork;
  if (v !== "devnet" && v !== "mainnet" && v !== "localnet") {
    throw new Error(`UMBRA_NETWORK invalid: ${v}`);
  }
  return v;
}

function resolveSubscriptionsUrl(rpcUrl: string): string {
  return (
    envOptional("UMBRA_RPC_SUBSCRIPTIONS_URL") ??
    rpcUrl.replace(/^https?:\/\//, "wss://")
  );
}

function deriveMerchantKeypair(
  merchantId: string,
  seedSecret: string,
): Keypair {
  const mac = createHmac("sha256", seedSecret);
  mac.update(`umbra/v1/merchant-signing-key|`);
  mac.update(merchantId);
  return Keypair.fromSeed(mac.digest());
}

function parseTreasurySecret(raw: string): Uint8Array {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("TREASURY_SECRET_KEY must be a JSON array of 64 integers");
  }
  if (!Array.isArray(parsed) || parsed.length !== 64) {
    throw new Error("TREASURY_SECRET_KEY must be 64 bytes");
  }
  return Uint8Array.from(parsed as number[]);
}

async function main() {
  const merchantId = process.argv[2];
  if (!merchantId) {
    throw new Error(
      "usage: pnpm umbra:bootstrap-merchant <merchantId>",
    );
  }

  const rpcUrl = envOrThrow("HELIUS_RPC_URL");
  const seedSecret = envOrThrow("UMBRA_AGENT_SEED_SECRET");
  const treasuryRaw = envOrThrow("TREASURY_SECRET_KEY");
  const network = resolveNetwork();
  const rpcSubscriptionsUrl = resolveSubscriptionsUrl(rpcUrl);

  const treasury = Keypair.fromSecretKey(parseTreasurySecret(treasuryRaw));
  const merchantKp = deriveMerchantKeypair(merchantId, seedSecret);
  const merchantEtaAddress = merchantKp.publicKey.toBase58();

  console.log("=== bootstrap demo merchant ===");
  console.log(`merchantId:          ${merchantId}`);
  console.log(`merchant ETA addr:   ${merchantEtaAddress}`);
  console.log(`network:             ${network}`);
  console.log("");

  // Step 1 — fund the merchant address from treasury so it can pay its own
  // Umbra registration fees (~0.01 SOL across 3 txs).
  const connection = new Connection(rpcUrl, "confirmed");
  const balance = await connection.getBalance(merchantKp.publicKey);
  if (balance >= SUBJECT_SOL_TARGET) {
    console.log(`→ SOL balance=${balance} ≥ target — skip funding`);
  } else {
    const lamports = SUBJECT_SOL_TARGET - balance;
    console.log(`→ funding ${merchantEtaAddress} with ${lamports} lamports from treasury`);
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: treasury.publicKey,
        toPubkey: merchantKp.publicKey,
        lamports,
      }),
    );
    const sig = await sendAndConfirmTransaction(connection, tx, [treasury]);
    console.log(`  ✓ funded sig=${sig.slice(0, 12)}…`);
  }
  console.log("");

  // Step 2 — register on Umbra with confidential+anonymous so the merchant
  // can both receive direct deposits AND be addressed via the mixer.
  const signer = await createSignerFromPrivateKeyBytes(merchantKp.secretKey);
  const client = await getUmbraClient({
    signer,
    network,
    rpcUrl,
    rpcSubscriptionsUrl,
    indexerApiEndpoint: envOptional("UMBRA_INDEXER_URL"),
  });
  const register = getUserRegistrationFunction(
    { client },
    { zkProver: getUserRegistrationProver() },
  );
  console.log("→ registering on Umbra (confidential + anonymous)...");
  const startedAt = Date.now();
  const sigs = await register({ confidential: true, anonymous: true });
  console.log(
    sigs.length === 0
      ? `  ✓ already registered (idempotent no-op, ${Date.now() - startedAt}ms)`
      : `  ✓ registered — ${sigs.length} tx(s) (${Date.now() - startedAt}ms)`,
  );
  console.log("");

  console.log("=== done ===");
  console.log(`Copy this into apps/demo-merchant-news/.env:`);
  console.log(``);
  console.log(`MERCHANT_ETA_ADDRESS="${merchantEtaAddress}"`);
}

main().catch((err) => {
  console.error("bootstrap failed:", err);
  process.exit(1);
});
