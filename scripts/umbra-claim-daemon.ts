import "dotenv/config";
import * as fs from "node:fs";
import * as path from "node:path";
import { createHmac } from "node:crypto";
import { Keypair } from "@solana/web3.js";
import {
  createSignerFromPrivateKeyBytes,
  getClaimableUtxoScannerFunction,
  getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction,
  getUmbraClient,
  getUmbraRelayer,
} from "@umbra-privacy/sdk";
import {
  getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver,
} from "@umbra-privacy/web-zk-prover";

// Background claim daemon: walks the mixer tree on behalf of a single subject
// (merchant or agent), pulls receiver-claimable UTXOs into their encrypted
// balance, and persists the next scan cursor in a JSON file so the next run
// resumes where this one left off.
//
// Invocation pattern: run from cron every ~minute per subject. Idempotent:
//   - Empty scan → no-op + cursor advances normally.
//   - Already-claimed UTXOs are filtered out by the scanner (they're consumed
//     and removed from the unclaimed set as soon as the claim tx lands).
//   - Crash mid-claim → next run re-fetches the same UTXOs from the indexer
//     and tries again. The relayer-side claim is idempotent at the nullifier
//     level (claiming a spent UTXO trips a circuit constraint and reverts).
//
// Usage:
//   pnpm exec tsx scripts/umbra-claim-daemon.ts <subject> <subjectId>
//
// Env required:
//   - HELIUS_RPC_URL
//   - UMBRA_AGENT_SEED_SECRET
//   - UMBRA_INDEXER_URL
//   - UMBRA_RELAYER_URL
//   - UMBRA_NETWORK (optional, default devnet)
//
// Cursor persistence:
//   <repo>/scripts/.scan-state/<subject>-<subjectId>.json
//   { "treeIndex": 0, "nextScanStartIndex": 42 }

type UmbraSubject = "agent" | "merchant";
type UmbraNetwork = "devnet" | "mainnet" | "localnet";

const STATE_DIR = path.resolve(__dirname, ".scan-state");

interface ScanState {
  treeIndex: number;
  nextScanStartIndex: number;
  // Set of "{treeIndex}:{leafIndex}" identifiers we've already claimed. The
  // SDK's scanner returns ALL UTXOs decryptable by our key — including spent
  // ones whose nullifiers are already published — and a relayer batch fails
  // wholesale if any UTXO in the batch is spent. We filter against this list
  // before passing to claim.
  claimedLeafIds?: string[];
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

function stateFileFor(subject: UmbraSubject, subjectId: string): string {
  return path.join(STATE_DIR, `${subject}-${subjectId}.json`);
}

function loadState(subject: UmbraSubject, subjectId: string): ScanState {
  const file = stateFileFor(subject, subjectId);
  if (!fs.existsSync(file)) {
    return { treeIndex: 0, nextScanStartIndex: 0, claimedLeafIds: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as ScanState;
    if (
      typeof parsed.treeIndex === "number" &&
      typeof parsed.nextScanStartIndex === "number"
    ) {
      return { ...parsed, claimedLeafIds: parsed.claimedLeafIds ?? [] };
    }
  } catch (err) {
    console.warn(`  ⚠ failed to parse ${file}, starting from zero:`, err);
  }
  return { treeIndex: 0, nextScanStartIndex: 0, claimedLeafIds: [] };
}

function saveState(
  subject: UmbraSubject,
  subjectId: string,
  state: ScanState,
): void {
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });
  const file = stateFileFor(subject, subjectId);
  fs.writeFileSync(file, JSON.stringify(state, null, 2));
}

async function main() {
  const subjectArg = process.argv[2];
  const subjectId = process.argv[3];
  if (subjectArg !== "agent" && subjectArg !== "merchant") {
    throw new Error(
      "usage: tsx scripts/umbra-claim-daemon.ts <agent|merchant> <subjectId>",
    );
  }
  if (!subjectId) {
    throw new Error("subjectId is required");
  }
  const subject = subjectArg as UmbraSubject;

  const rpcUrl = envOrThrow("HELIUS_RPC_URL");
  const seedSecret = envOrThrow("UMBRA_AGENT_SEED_SECRET");
  const indexerUrl = envOrThrow("UMBRA_INDEXER_URL");
  const relayerUrl = envOrThrow("UMBRA_RELAYER_URL");
  const network = resolveNetwork();
  const rpcSubscriptionsUrl = resolveSubscriptionsUrl(rpcUrl);

  const kp = deriveSubjectKeypair(subject, subjectId, seedSecret);
  console.log(`[claim-daemon] ${subject}=${subjectId}`);
  console.log(`  eta_address=${kp.publicKey.toBase58()}`);

  const signer = await createSignerFromPrivateKeyBytes(kp.secretKey);
  const client = await getUmbraClient({
    signer,
    network,
    rpcUrl,
    rpcSubscriptionsUrl,
    indexerApiEndpoint: indexerUrl,
  });

  const state = loadState(subject, subjectId);
  console.log(
    `  cursor: tree=${state.treeIndex} startIndex=${state.nextScanStartIndex}`,
  );

  // Phase 1: scan.
  const scan = getClaimableUtxoScannerFunction({ client });
  const scanStarted = Date.now();
  // SDK U32 args are bigints; pass BigInts, not numbers.
  const scanResult = await scan(
    BigInt(state.treeIndex) as never,
    BigInt(state.nextScanStartIndex) as never,
  );
  console.log(
    `  scan: received=${scanResult.received.length} ` +
      `selfBurnable=${scanResult.selfBurnable.length} ` +
      `next=${scanResult.nextScanStartIndex} ` +
      `(${Date.now() - scanStarted}ms)`,
  );

  // The scanner returns ALL UTXOs decryptable by our key, including ones
  // we've already claimed (their nullifiers are spent on-chain, but the
  // indexer still surfaces the ciphertext). The relayer's batched ZK proof
  // fails wholesale if any UTXO in the batch has a spent nullifier, so we
  // filter against the locally-tracked claimed set before submitting.
  const claimedSet = new Set(state.claimedLeafIds ?? []);
  const leafKey = (u: { treeIndex: bigint; insertionIndex: bigint }) =>
    `${u.treeIndex}:${u.insertionIndex}`;
  const freshUtxos = scanResult.received.filter(
    (u) => !claimedSet.has(leafKey(u)),
  );
  console.log(
    `  filter: ${freshUtxos.length} fresh / ${scanResult.received.length} ` +
      `(skipped ${scanResult.received.length - freshUtxos.length} already claimed)`,
  );

  if (freshUtxos.length === 0) {
    saveState(subject, subjectId, {
      treeIndex: state.treeIndex,
      nextScanStartIndex: Number(scanResult.nextScanStartIndex),
      claimedLeafIds: Array.from(claimedSet),
    });
    console.log("  ✓ nothing fresh to claim, exiting");
    return;
  }

  // Phase 2: claim.
  if (!client.fetchBatchMerkleProof) {
    throw new Error(
      "Umbra client missing fetchBatchMerkleProof — check UMBRA_INDEXER_URL is reachable",
    );
  }
  const relayer = getUmbraRelayer({ apiEndpoint: relayerUrl });
  const claim = getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction(
    { client },
    {
      fetchBatchMerkleProof: client.fetchBatchMerkleProof,
      zkProver: getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver(),
      relayer: {
        submitClaim: relayer.submitClaim,
        pollClaimStatus: relayer.pollClaimStatus,
        getRelayerAddress: relayer.getRelayerAddress,
      },
    },
  );
  const claimStarted = Date.now();
  const result = await claim(freshUtxos);
  console.log(
    `  claim: batches=${result.batches.size} (${Date.now() - claimStarted}ms)`,
  );

  // Walk per-batch results and record only successfully-claimed leaf IDs.
  // batch.utxoIds comes back as "treeIndex:leafIndex" strings; we treat
  // anything other than 'completed' as not-claimed-yet and let the next run
  // retry. The SDK's nullifier check makes double-claim a circuit revert,
  // so even a stale "claimed" entry can't cause double-spend.
  const newlyClaimed: string[] = [];
  for (const [idx, batch] of result.batches.entries()) {
    console.log(
      `    batch ${idx}: status=${batch.status} ` +
        `tx=${batch.txSignature ?? "(none)"} ` +
        `cb=${batch.callbackSignature ?? "(none)"}`,
    );
    if (batch.status === "completed" && batch.utxoIds) {
      for (const id of batch.utxoIds) newlyClaimed.push(id);
    }
  }

  // Persist cursor + claimed-set AFTER claim resolution. Empty-page advance
  // happened above; here we only land if we attempted a claim, regardless of
  // per-batch outcome. A crash before this write means the next run re-scans
  // the same page and retries — idempotent under the SDK's nullifier check.
  saveState(subject, subjectId, {
    treeIndex: state.treeIndex,
    nextScanStartIndex: Number(scanResult.nextScanStartIndex),
    claimedLeafIds: Array.from(new Set([...claimedSet, ...newlyClaimed])),
  });
  console.log(
    `  ✓ done — newly claimed: ${newlyClaimed.length}, ` +
      `total tracked: ${claimedSet.size + newlyClaimed.length}`,
  );
}

main().catch((err) => {
  console.error("daemon failed:", err);
  process.exit(1);
});
