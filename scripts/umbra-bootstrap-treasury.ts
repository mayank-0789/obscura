import "dotenv/config";
import {
  createSignerFromPrivateKeyBytes,
  getUmbraClient,
  getUserRegistrationFunction,
} from "@umbra-privacy/sdk";
import { Keypair } from "@solana/web3.js";

// One-time idempotent script. Registers the treasury keypair on Umbra so it
// can hand-off encrypted-balance deposits to agents/merchants. Re-running is
// safe — the SDK's user-registration helper skips already-completed steps.
//
// Usage: `pnpm umbra:bootstrap-treasury`
//
// Env required:
//   - HELIUS_RPC_URL
//   - TREASURY_SECRET_KEY  (JSON array, 64 bytes)
//   - UMBRA_NETWORK        (devnet | mainnet | localnet, default devnet)
//
// NOTE: this script intentionally duplicates a slim version of the
// `lib/umbra.ts` client-build logic instead of importing it. lib/umbra.ts
// has `server-only` + `@/` path aliases that don't survive `tsx` execution.
// Keep the two in sync if SDK signatures change.

function fromEnv(name: string, required = true): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    if (required) {
      throw new Error(`env var ${name} is required`);
    }
    return "";
  }
  return value;
}

function parseTreasurySecret(raw: string): Uint8Array {
  // Accept the standard Solana CLI keypair format: a JSON array of 64 ints.
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

function resolveNetwork(): "devnet" | "mainnet" | "localnet" {
  const v = fromEnv("UMBRA_NETWORK", false) || "devnet";
  if (v !== "devnet" && v !== "mainnet" && v !== "localnet") {
    throw new Error(`UMBRA_NETWORK invalid: ${v}`);
  }
  return v;
}

function resolveSubscriptionsUrl(rpcUrl: string): string {
  const override = fromEnv("UMBRA_RPC_SUBSCRIPTIONS_URL", false);
  if (override) return override;
  return rpcUrl.replace(/^https?:\/\//, "wss://");
}

async function main() {
  const rpcUrl = fromEnv("HELIUS_RPC_URL");
  const treasuryRaw = fromEnv("TREASURY_SECRET_KEY");
  const network = resolveNetwork();
  const rpcSubscriptionsUrl = resolveSubscriptionsUrl(rpcUrl);

  const treasury = Keypair.fromSecretKey(parseTreasurySecret(treasuryRaw));
  console.log(`treasury pubkey: ${treasury.publicKey.toBase58()}`);
  console.log(`network:         ${network}`);
  console.log(`rpc:             ${rpcUrl.replace(/api-key=[^&]+/, "api-key=…")}`);

  const signer = await createSignerFromPrivateKeyBytes(treasury.secretKey);
  const client = await getUmbraClient({
    signer,
    network,
    rpcUrl,
    rpcSubscriptionsUrl,
  });

  const register = getUserRegistrationFunction({ client });

  console.log("→ registering treasury on Umbra...");
  // confidential:true creates the X25519 key Umbra needs for the
  // `getPublicBalanceToEncryptedBalanceDirectDepositorFunction` flow we use
  // on the Dodo webhook path. anonymous:false skips the ZK-prover dep
  // (Phase 2 territory). Both choices match lib/umbra.ts.
  const signatures = await register({ confidential: true, anonymous: false });
  if (signatures.length === 0) {
    console.log("✓ already registered (idempotent no-op)");
  } else {
    console.log(
      `✓ registered — ${signatures.length} tx(s):\n  ${signatures.map(String).join("\n  ")}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
