import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { createHmac } from "node:crypto";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  Connection,
} from "@solana/web3.js";
import { address } from "@solana/kit";
import {
  createSignerFromPrivateKeyBytes,
  getClaimableUtxoScannerFunction,
  getEncryptedBalanceQuerierFunction,
  getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction,
  getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction,
  getUmbraClient,
  getUmbraRelayer,
  getUserRegistrationFunction,
} from "@umbra-privacy/sdk";
import {
  getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver,
  getCreateReceiverClaimableUtxoFromEncryptedBalanceProver,
  getUserRegistrationProver,
} from "@umbra-privacy/web-zk-prover";

// Single-shot mixer round-trip:
//   sender (existing agent ETA, has WSOL deposited)  →  mixer UTXO  →
//   receiver (deterministic test merchant we register on the fly).
//
// Verifies the Path B (mixer-based ETA→ETA) flow before wiring it into the
// /api/x402/sign route. Uses the same HMAC seed-derivation and SDK calls as
// apps/web/lib/umbra.ts, duplicated here so `tsx` doesn't need the @/ aliases.
//
// Usage:
//   pnpm exec tsx scripts/umbra-test-mixer-send.ts <senderAgentId> [amountMicros]
//
// Env required:
//   - HELIUS_RPC_URL
//   - TREASURY_SECRET_KEY     (for SOL-funding the receiver address)
//   - UMBRA_AGENT_SEED_SECRET (HMAC root)
//   - STABLECOIN_MINT         (devnet WSOL: So111…112)
//   - UMBRA_INDEXER_URL       (for scan + claim)
//   - UMBRA_RELAYER_URL       (for claim)

type UmbraSubject = "agent" | "merchant";
type UmbraNetwork = "devnet" | "mainnet" | "localnet";

const DEFAULT_AMOUNT_MICROS = 1_000_000n; // 0.001 WSOL on devnet (9 dec)
const RECEIVER_TEST_ID = "mixer-test-receiver-002";
const SUBJECT_SOL_TARGET = 0.05 * LAMPORTS_PER_SOL;

// Claimed-leaf tracking — same path the daemon uses, keyed per subject. Lets
// the test re-run cleanly across invocations without bumping the receiver ID
// every time, by filtering out UTXOs whose nullifiers we've already burned.
const STATE_DIR = path.resolve(__dirname, ".scan-state");
const claimedFileFor = (subject: UmbraSubject, subjectId: string) =>
  path.join(STATE_DIR, `${subject}-${subjectId}-claimed.json`);

function loadClaimedSet(
  subject: UmbraSubject,
  subjectId: string,
): Set<string> {
  const file = claimedFileFor(subject, subjectId);
  if (!fs.existsSync(file)) return new Set();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveClaimedSet(
  subject: UmbraSubject,
  subjectId: string,
  set: Set<string>,
): void {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(
    claimedFileFor(subject, subjectId),
    JSON.stringify(Array.from(set), null, 2),
  );
}

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

function deriveSubjectKeypair(
  subject: UmbraSubject,
  subjectId: string,
  seedSecret: string,
): Keypair {
  const mac = createHmac("sha256", seedSecret);
  mac.update(`umbra/v1/${subject}-signing-key|`);
  mac.update(subjectId);
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

async function buildClient(opts: {
  signer: Awaited<ReturnType<typeof createSignerFromPrivateKeyBytes>>;
  rpcUrl: string;
  rpcSubscriptionsUrl: string;
  network: UmbraNetwork;
  indexerApiEndpoint?: string;
}) {
  return getUmbraClient({
    signer: opts.signer,
    network: opts.network,
    rpcUrl: opts.rpcUrl,
    rpcSubscriptionsUrl: opts.rpcSubscriptionsUrl,
    indexerApiEndpoint: opts.indexerApiEndpoint,
  });
}

async function fundIfNeeded(
  connection: Connection,
  treasury: Keypair,
  recipient: PublicKey,
): Promise<void> {
  const balance = await connection.getBalance(recipient);
  if (balance >= SUBJECT_SOL_TARGET) {
    console.log(`  → SOL balance=${balance} ≥ target — skip`);
    return;
  }
  const lamports = SUBJECT_SOL_TARGET - balance;
  console.log(`  → funding ${recipient.toBase58()} with ${lamports} lamports`);
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: recipient,
      lamports,
    }),
  );
  const sig = await sendAndConfirmTransaction(connection, tx, [treasury]);
  console.log(`  ✓ funded sig=${sig.slice(0, 16)}…`);
}

async function readEncryptedBalance(
  client: Awaited<ReturnType<typeof getUmbraClient>>,
  mintBase58: string,
): Promise<bigint | null> {
  const query = getEncryptedBalanceQuerierFunction({ client });
  const mintAddr = address(mintBase58);
  const result = await query([mintAddr]);
  const entry = result.get(mintAddr);
  if (!entry) return null;
  if (entry.state === "shared") return BigInt(entry.balance);
  return null;
}

async function main() {
  const senderAgentId = process.argv[2];
  if (!senderAgentId) {
    throw new Error(
      "usage: tsx scripts/umbra-test-mixer-send.ts <senderAgentId> [amountMicros]",
    );
  }
  const amountMicros = process.argv[3]
    ? BigInt(process.argv[3])
    : DEFAULT_AMOUNT_MICROS;

  const rpcUrl = envOrThrow("HELIUS_RPC_URL");
  const seedSecret = envOrThrow("UMBRA_AGENT_SEED_SECRET");
  const treasuryRaw = envOrThrow("TREASURY_SECRET_KEY");
  const mintBase58 = envOrThrow("STABLECOIN_MINT");
  const indexerUrl = envOrThrow("UMBRA_INDEXER_URL");
  const relayerUrl = envOrThrow("UMBRA_RELAYER_URL");

  const network = resolveNetwork();
  const rpcSubscriptionsUrl = resolveSubscriptionsUrl(rpcUrl);
  const treasury = Keypair.fromSecretKey(parseTreasurySecret(treasuryRaw));
  const connection = new Connection(rpcUrl, "confirmed");

  console.log("=== mixer round-trip test ===");
  console.log(`network:    ${network}`);
  console.log(`mint:       ${mintBase58}`);
  console.log(`sender:     agent=${senderAgentId}`);
  console.log(`receiver:   merchant=${RECEIVER_TEST_ID} (deterministic)`);
  console.log(`amount:     ${amountMicros} micros`);
  console.log("");

  // --- Step 1: Register both subjects with anonymous-usage active. ---
  // Mixer flow requires the user-commitment bit on BOTH sender and receiver
  // (Umbra err 18003 otherwise). Registration is idempotent — the SDK reads
  // status bits per step and skips ones already done, so re-running this on
  // an agent originally registered with anonymous:false will only run the
  // anonymous step (single tx, ~10s).
  console.log("→ Step 1: Ensure sender + receiver are registered (anonymous=true)");
  const receiverKp = deriveSubjectKeypair("merchant", RECEIVER_TEST_ID, seedSecret);
  const senderKp = deriveSubjectKeypair("agent", senderAgentId, seedSecret);
  console.log(`  receiver eta_address=${receiverKp.publicKey.toBase58()}`);
  console.log(`  sender   eta_address=${senderKp.publicKey.toBase58()}`);
  await fundIfNeeded(connection, treasury, receiverKp.publicKey);
  await fundIfNeeded(connection, treasury, senderKp.publicKey);

  const receiverSigner = await createSignerFromPrivateKeyBytes(receiverKp.secretKey);
  const receiverClient = await buildClient({
    signer: receiverSigner,
    rpcUrl,
    rpcSubscriptionsUrl,
    network,
    indexerApiEndpoint: indexerUrl,
  });
  const senderSigner = await createSignerFromPrivateKeyBytes(senderKp.secretKey);
  const senderClient = await buildClient({
    signer: senderSigner,
    rpcUrl,
    rpcSubscriptionsUrl,
    network,
    indexerApiEndpoint: indexerUrl,
  });

  const userRegProver = getUserRegistrationProver();
  for (const [label, client] of [
    ["receiver", receiverClient],
    ["sender", senderClient],
  ] as const) {
    const register = getUserRegistrationFunction(
      { client },
      { zkProver: userRegProver },
    );
    const regSigs = await register({ confidential: true, anonymous: true });
    console.log(
      `  ${label}: ` +
        (regSigs.length === 0
          ? "✓ already registered"
          : `✓ registered/updated (${regSigs.length} tx)`),
    );
  }
  console.log("");

  // --- Step 2: Read pre-tx balances on both sides. ---
  console.log("→ Step 2: Read pre-tx encrypted balances");
  const senderBefore = await readEncryptedBalance(senderClient, mintBase58);
  const receiverBefore = await readEncryptedBalance(receiverClient, mintBase58);
  console.log(`  sender   pre = ${senderBefore ?? "(unregistered)"}`);
  console.log(`  receiver pre = ${receiverBefore ?? "(zero)"}`);
  if (senderBefore === null) {
    throw new Error(
      `sender agent=${senderAgentId} has no encrypted balance. Top it up first.`,
    );
  }
  if (senderBefore < amountMicros) {
    throw new Error(
      `sender balance ${senderBefore} < amount ${amountMicros}. Top up more first.`,
    );
  }
  console.log("");

  // --- Step 3: Create the receiver-claimable UTXO. ---
  console.log("→ Step 3: Create receiver-claimable UTXO via mixer");
  const createUtxo = getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction(
    { client: senderClient },
    { zkProver: getCreateReceiverClaimableUtxoFromEncryptedBalanceProver() },
  );
  const createStarted = Date.now();
  const createResult = await createUtxo({
    amount: amountMicros as never,
    destinationAddress: address(receiverKp.publicKey.toBase58()),
    mint: address(mintBase58),
  });
  console.log(`  ✓ created in ${Date.now() - createStarted}ms`);
  console.log(`    proofSig    = ${createResult.createProofAccountSignature}`);
  console.log(`    queueSig    = ${createResult.queueSignature}`);
  console.log(`    callbackSig = ${createResult.callbackSignature ?? "(none)"}`);
  console.log(`    cbStatus    = ${createResult.callbackStatus ?? "(none)"}`);
  if (createResult.callbackStatus !== "finalized") {
    console.warn(
      "  ⚠ callbackStatus !== 'finalized' — UTXO may still resolve async; " +
        "scan + claim below may find nothing. Try re-running.",
    );
  }
  console.log("");

  // --- Step 4: Scan for receiver-claimable UTXOs. ---
  console.log("→ Step 4: Scan for receiver-claimable UTXOs");
  const scan = getClaimableUtxoScannerFunction({ client: receiverClient });
  // Tree 0 from the start. In production the daemon persists nextScanStartIndex.
  // SDK uses branded U32 types backed by bigints — pass 0n, not 0, or the
  // SDK's internal `treeIndex * 1_048_576n` arithmetic throws BigInt-vs-number.
  const scanStarted = Date.now();
  const scanResult = await scan(0n as never, 0n as never);
  console.log(`  ✓ scanned in ${Date.now() - scanStarted}ms`);
  console.log(`    received          = ${scanResult.received.length}`);
  console.log(`    selfBurnable      = ${scanResult.selfBurnable.length}`);
  console.log(`    nextScanStartIdx  = ${scanResult.nextScanStartIndex}`);
  if (scanResult.received.length === 0) {
    console.warn("  ⚠ no receiver UTXOs found — UTXO may not be in tree yet. Exiting.");
    return;
  }

  // The scanner returns ALL UTXOs decryptable by our key, including ones
  // already claimed in prior runs (their nullifiers are spent on-chain, but
  // the indexer still surfaces the ciphertext). The relayer's batched ZK
  // proof rejects the whole batch if any UTXO is spent, so we filter against
  // a locally-tracked claimed set persisted in scripts/.scan-state/. This
  // mirrors the daemon's pattern (see scripts/umbra-claim-daemon.ts).
  const claimedBefore = loadClaimedSet("merchant", RECEIVER_TEST_ID);
  const leafKey = (u: { treeIndex: bigint; insertionIndex: bigint }) =>
    `${u.treeIndex}:${u.insertionIndex}`;
  const freshUtxos = scanResult.received.filter(
    (u) => !claimedBefore.has(leafKey(u)),
  );
  console.log(
    `    filter: ${freshUtxos.length} fresh / ${scanResult.received.length} ` +
      `(skipped ${scanResult.received.length - freshUtxos.length} already claimed)`,
  );
  if (freshUtxos.length === 0) {
    console.warn(
      "  ⚠ all UTXOs already claimed in prior runs — bump RECEIVER_TEST_ID " +
        "for a clean re-validation. Exiting.",
    );
    return;
  }
  console.log("");

  // --- Step 5: Claim into the receiver's encrypted balance. ---
  console.log("→ Step 5: Claim UTXOs into receiver ETA");
  const relayer = getUmbraRelayer({ apiEndpoint: relayerUrl });
  const claim = getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction(
    { client: receiverClient },
    {
      fetchBatchMerkleProof: receiverClient.fetchBatchMerkleProof!,
      zkProver: getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver(),
      relayer: {
        submitClaim: relayer.submitClaim,
        pollClaimStatus: relayer.pollClaimStatus,
        getRelayerAddress: relayer.getRelayerAddress,
      },
    },
  );
  const claimStarted = Date.now();
  const claimResult = await claim(freshUtxos);
  console.log(`  ✓ claimed in ${Date.now() - claimStarted}ms`);
  console.log(`    batches=${claimResult.batches.size}`);
  const newlyClaimed: string[] = [];
  for (const [idx, batch] of claimResult.batches.entries()) {
    console.log(
      `      batch ${idx}: status=${batch.status} ` +
        `tx=${batch.txSignature ?? "(none)"} ` +
        `cb=${batch.callbackSignature ?? "(none)"}`,
    );
    if (batch.status === "completed" && batch.utxoIds) {
      for (const id of batch.utxoIds) newlyClaimed.push(id);
    }
  }
  if (newlyClaimed.length > 0) {
    saveClaimedSet(
      "merchant",
      RECEIVER_TEST_ID,
      new Set([...claimedBefore, ...newlyClaimed]),
    );
  }
  console.log("");

  // --- Step 6: Verify balances moved as expected. ---
  console.log("→ Step 6: Read post-tx encrypted balances");
  const senderAfter = await readEncryptedBalance(senderClient, mintBase58);
  const receiverAfter = await readEncryptedBalance(receiverClient, mintBase58);
  console.log(`  sender   post = ${senderAfter ?? "(?)"}`);
  console.log(`  receiver post = ${receiverAfter ?? "(?)"}`);
  if (senderBefore !== null && senderAfter !== null) {
    console.log(`  sender Δ      = -${senderBefore - senderAfter} (expected ≥${amountMicros})`);
  }
  if (receiverAfter !== null) {
    const rBefore = receiverBefore ?? 0n;
    console.log(`  receiver Δ    = +${receiverAfter - rBefore}`);
    if (receiverAfter - rBefore >= amountMicros - 100_000n) {
      console.log("  ✅ receiver credited");
    } else {
      console.log(
        "  ⚠ receiver delta below amount — fees deducted, or claim still settling",
      );
    }
  }
}

main().catch((err) => {
  console.error("test failed:", err);
  process.exit(1);
});
