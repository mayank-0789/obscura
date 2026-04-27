import "server-only";
import { createHmac } from "node:crypto";
import {
  Keypair,
  PublicKey,
  type Connection,
} from "@obscura-app/solana";
import {
  LAMPORTS_PER_SOL,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { address } from "@solana/kit";
import {
  createSignerFromPrivateKeyBytes,
  getClaimableUtxoScannerFunction,
  getEncryptedBalanceQuerierFunction,
  getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction,
  getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction,
  getPublicBalanceToEncryptedBalanceDirectDepositorFunction,
  getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction,
  getUmbraClient,
  getUmbraRelayer,
  getUserRegistrationFunction,
} from "@umbra-privacy/sdk";
import type {
  ClaimUtxoIntoEncryptedBalanceResult,
  CreateUtxoFromEncryptedBalanceResult,
  DepositResult,
  IUmbraClient,
  IUmbraRelayer,
  IUmbraSigner,
  ScannedUtxoData,
  WithdrawResult,
} from "@umbra-privacy/sdk/interfaces";
import type { U64 } from "@umbra-privacy/sdk/types";
import {
  getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver,
  getCreateReceiverClaimableUtxoFromEncryptedBalanceProver,
  getUserRegistrationProver,
} from "@umbra-privacy/web-zk-prover";
import { env } from "@/lib/env";
import { getConnection, getStablecoinMint, getTreasury } from "@/lib/solana";

// ── Identity model ───────────────────────────────────────────────────────────
//
// Every agent + merchant gets an Umbra keypair derived deterministically from
// our env-stored master secret + their UUID. We never store the keypair —
// re-derive on demand. The master secret is the single critical secret in this
// system: lose it and every encrypted balance is unrecoverable.
//
// Subject domain separation prevents an agent.id and a merchant.id ever
// producing the same key (they're both UUIDs from independent generators).
//
// Using HMAC-SHA-256 → 32-byte seed → Ed25519 keypair via Keypair.fromSeed.
// Q2 of the Umbra Discord Q&A (2026-04-25): override `masterSeedStorage` to
// bypass the wallet signMessage flow that's the SDK's default. We supply the
// 32-byte master seed directly — server has the key, no popup.

export type UmbraSubject = "agent" | "merchant";

const DOMAIN_SEPARATOR_PREFIX = "umbra/v1/" as const;

// Trailing pipe is a delimiter that prevents prefix collisions: without it,
// `umbra/v1/agent-signing-key` + `<id1>` could collide with a hypothetical
// future label like `umbra/v1/agent-signing` + `key<id2>`. The pipe is not a
// valid base58 / UUID character, so HMAC inputs always parse uniquely.
// Bumping `v1` rotates EVERY agent + merchant key (do not change without a
// migration plan).
function buildDomainSeparator(subject: UmbraSubject): string {
  return `${DOMAIN_SEPARATOR_PREFIX}${subject}-signing-key|`;
}

function deriveSeed(subject: UmbraSubject, subjectId: string): Uint8Array {
  const mac = createHmac("sha256", env.UMBRA_AGENT_SEED_SECRET);
  mac.update(buildDomainSeparator(subject));
  mac.update(subjectId);
  return mac.digest();
}

function deriveKeypair(subject: UmbraSubject, subjectId: string): Keypair {
  return Keypair.fromSeed(deriveSeed(subject, subjectId));
}

/**
 * Returns the on-chain Solana address (base58 pubkey) for the Umbra-side
 * keypair of an agent or merchant. Pure derivation — safe to call inside a
 * DB batch; no I/O, no SDK init, no network. Used by `/api/agents` POST to
 * persist the eta_address column at create time.
 */
export function deriveSubjectEtaAddress(
  subject: UmbraSubject,
  subjectId: string,
): string {
  return deriveKeypair(subject, subjectId).publicKey.toBase58();
}

// Convenience wrappers for clarity at call sites.
export const deriveAgentEtaAddress = (agentId: string) =>
  deriveSubjectEtaAddress("agent", agentId);
export const deriveMerchantEtaAddress = (merchantId: string) =>
  deriveSubjectEtaAddress("merchant", merchantId);

// ── SDK signer + client factories ────────────────────────────────────────────

async function getSubjectSigner(
  subject: UmbraSubject,
  subjectId: string,
): Promise<IUmbraSigner> {
  // Pass the full 64-byte secretKey (seed||pubkey) — same layout the SDK's
  // adapter expects for Solana CLI keypair inputs.
  return createSignerFromPrivateKeyBytes(
    deriveKeypair(subject, subjectId).secretKey,
  );
}

// HELIUS_RPC_URL is HTTPS; the Umbra SDK's WS-based transaction forwarder needs
// a wss:// endpoint for subscribe-based confirmation. Most Solana RPC providers
// (Helius, QuickNode, Triton) mirror the HTTP endpoint at the same path under
// wss://, so we derive by default — but allow an explicit override for setups
// where the WS endpoint diverges (e.g. a proxy that only fronts HTTP).
function resolveRpcSubscriptionsUrl(): string {
  if (env.UMBRA_RPC_SUBSCRIPTIONS_URL) return env.UMBRA_RPC_SUBSCRIPTIONS_URL;
  return env.HELIUS_RPC_URL.replace(/^https?:\/\//, "wss://");
}

/**
 * Build an Umbra client for a specific subject (agent or merchant). NOT cached
 * — subjects come and go, and the master-seed derivation is fast (one HMAC,
 * no network). The treasury client IS cached (`getTreasuryUmbraClient`) since
 * its registration metadata is process-wide.
 *
 * @param subject  `'agent'` or `'merchant'` — domain-separated key derivation
 * @param subjectId  the subject's UUID (agents.id or merchants.id)
 */
export async function buildSubjectUmbraClient(
  subject: UmbraSubject,
  subjectId: string,
): Promise<IUmbraClient> {
  const signer = await getSubjectSigner(subject, subjectId);
  return getUmbraClient({
    signer,
    network: env.UMBRA_NETWORK,
    rpcUrl: env.HELIUS_RPC_URL,
    rpcSubscriptionsUrl: resolveRpcSubscriptionsUrl(),
    indexerApiEndpoint: env.UMBRA_INDEXER_URL,
  });
}

let cachedTreasuryClient: Promise<IUmbraClient> | null = null;

/**
 * Treasury Umbra client. Cached for the lifetime of the process: registration
 * is idempotent (SDK skips already-completed steps) but constructing the
 * client involves the master-seed signMessage round-trip and a network ID
 * fetch — both wasteful per request.
 *
 * On rejection we clear the cache so a transient devnet failure at boot
 * doesn't permanently poison the singleton (next caller retries with a fresh
 * build).
 */
export function getTreasuryUmbraClient(): Promise<IUmbraClient> {
  if (!cachedTreasuryClient) {
    cachedTreasuryClient = buildTreasuryUmbraClient().catch((err) => {
      cachedTreasuryClient = null;
      throw err;
    });
  }
  return cachedTreasuryClient;
}

async function buildTreasuryUmbraClient(): Promise<IUmbraClient> {
  const treasury = getTreasury();
  // web3.js Keypair.secretKey is 64 bytes (32 seed || 32 pubkey) — the same
  // layout @umbra-privacy/sdk's createSignerFromPrivateKeyBytes accepts.
  const signer = await createSignerFromPrivateKeyBytes(treasury.secretKey);
  return getUmbraClient({
    signer,
    network: env.UMBRA_NETWORK,
    rpcUrl: env.HELIUS_RPC_URL,
    rpcSubscriptionsUrl: resolveRpcSubscriptionsUrl(),
    indexerApiEndpoint: env.UMBRA_INDEXER_URL,
  });
}

// ── High-level operations ────────────────────────────────────────────────────
// Wrappers that hide @solana/kit's branded types (`Address`, `U64`) from call
// sites. Routes deal in plain strings + bigints as they always have.

/**
 * Registers a subject (agent or merchant) on Umbra. Idempotent — calling
 * register on an already-registered user is a no-op for steps already done.
 * Returns the array of TransactionSignatures the SDK produced; empty when
 * registration was already complete.
 *
 * `confidential: true` creates the X25519 key needed to receive direct ETA
 * deposits. `anonymous: true` registers the user commitment used by the mixer
 * — required on BOTH sender AND receiver before any ETA→ETA mixer transfer
 * (Umbra error 18003 fires otherwise). The anonymous step requires a
 * Groth16 ZK proof; we inject the prover from `@umbra-privacy/web-zk-prover`.
 *
 * Idempotency lets us re-call this on subjects originally registered with
 * `anonymous: false` — the SDK reads the on-chain status bits per step and
 * skips the confidential (already-set) bit while running just the anonymous
 * step.
 */
export async function registerSubjectOnUmbra(
  subject: UmbraSubject,
  subjectId: string,
): Promise<string[]> {
  console.info(`[umbra/register] ${subject}=${subjectId} → calling SDK`);
  const startedAt = Date.now();
  const client = await buildSubjectUmbraClient(subject, subjectId);
  const register = getUserRegistrationFunction(
    { client },
    { zkProver: getUserRegistrationProver() },
  );
  const signatures = await register({ confidential: true, anonymous: true });
  const sigs = signatures.map((s) => String(s));
  console.info(
    `[umbra/register] ${subject}=${subjectId} ✓ took=${Date.now() - startedAt}ms ` +
      `txs=${sigs.length} sigs=[${sigs.join(",") || "idempotent no-op"}]`,
  );
  return sigs;
}

// SOL the subject's derived address needs to keep on hand to pay for its own
// registration (3 txs) plus a generous buffer for future Umbra ops.
const SUBJECT_UMBRA_SOL_TARGET = 0.05 * LAMPORTS_PER_SOL;

/**
 * Top up the subject's derived Umbra address with SOL from the treasury so it
 * can pay its own registration / deposit fees. Idempotent — checks the
 * on-chain balance first and no-ops when the target is already met. Run
 * before `registerSubjectOnUmbra`; a freshly-derived address starts with zero
 * SOL and the SDK's `register({confidential:true})` flow uses the subject's
 * signer as the fee-payer, so without this the registration tx fails with
 * insufficient-funds.
 */
export async function fundSubjectAddressIfNeeded(
  etaAddress: string,
): Promise<void> {
  const connection = getConnection();
  const recipient = new PublicKey(etaAddress);
  const balance = await connection.getBalance(recipient);
  if (balance >= SUBJECT_UMBRA_SOL_TARGET) {
    console.info(
      `[umbra/sol-fund] address=${etaAddress} balance=${balance} ` +
        `≥ target=${SUBJECT_UMBRA_SOL_TARGET} — skip`,
    );
    return;
  }

  const treasury = getTreasury();
  const lamports = SUBJECT_UMBRA_SOL_TARGET - balance;
  console.info(
    `[umbra/sol-fund] address=${etaAddress} balance=${balance} ` +
      `target=${SUBJECT_UMBRA_SOL_TARGET} → sending ${lamports} lamports from treasury`,
  );
  const sig = await sendSolFromTreasury(connection, recipient, lamports, treasury);
  console.info(`[umbra/sol-fund] address=${etaAddress} ✓ sig=${sig}`);
}

async function sendSolFromTreasury(
  connection: Connection,
  to: PublicKey,
  lamports: number,
  treasury: Keypair,
): Promise<string> {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: treasury.publicKey,
      toPubkey: to,
      lamports,
    }),
  );
  return sendAndConfirmTransaction(connection, tx, [treasury]);
}

/**
 * Treasury → subject's encrypted balance, single deposit. Used by the Dodo
 * webhook to credit a topped-up agent. The deposit *event* (sender, recipient
 * address, mint, gross amount) is publicly visible on-chain by design; the
 * resulting encrypted balance value is hidden. See umbra_protocol_brief.md
 * for why this Phase 1 trade-off is acceptable.
 *
 * Returns the SDK's DepositResult so callers see both the queue + Arcium
 * callback signatures. `callbackStatus = 'finalized'` is the only success
 * state — `pruned` / `timed-out` mean the op may still resolve async; verify
 * on-chain before retrying.
 */
export async function depositTreasuryToEncryptedAccount(input: {
  etaAddress: string;
  amountMicros: bigint;
}): Promise<DepositResult> {
  const mintBase58 = getStablecoinMint().toBase58();
  console.info(
    `[umbra/deposit] → SDK call address=${input.etaAddress} ` +
      `mint=${mintBase58} amountMicros=${input.amountMicros}`,
  );
  const startedAt = Date.now();
  const client = await getTreasuryUmbraClient();
  const deposit = getPublicBalanceToEncryptedBalanceDirectDepositorFunction({
    client,
  });
  const result = await deposit(
    address(input.etaAddress),
    address(mintBase58),
    input.amountMicros as U64,
  );
  console.info(
    `[umbra/deposit] address=${input.etaAddress} took=${Date.now() - startedAt}ms ` +
      `queueSig=${result.queueSignature} ` +
      `callbackSig=${result.callbackSignature ?? "(none)"} ` +
      `callbackStatus=${result.callbackStatus ?? "(none)"}`,
  );
  return result;
}

/**
 * Subject's encrypted balance → public ATA. Used by employee withdraw flows.
 * Subject must own the destination ATA's mint (or one will be created).
 */
export async function withdrawFromEncryptedAccount(input: {
  subject: UmbraSubject;
  subjectId: string;
  destinationAddress: string;
  amountMicros: bigint;
}): Promise<WithdrawResult> {
  const mintBase58 = getStablecoinMint().toBase58();
  console.info(
    `[umbra/withdraw] → SDK call ${input.subject}=${input.subjectId} ` +
      `dest=${input.destinationAddress} mint=${mintBase58} ` +
      `amountMicros=${input.amountMicros}`,
  );
  const startedAt = Date.now();
  const client = await buildSubjectUmbraClient(input.subject, input.subjectId);
  const withdraw = getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction({
    client,
  });
  const result = await withdraw(
    address(input.destinationAddress),
    address(mintBase58),
    input.amountMicros as U64,
  );
  console.info(
    `[umbra/withdraw] ${input.subject}=${input.subjectId} ` +
      `took=${Date.now() - startedAt}ms ` +
      `queueSig=${result.queueSignature} ` +
      `callbackSig=${result.callbackSignature ?? "(none)"} ` +
      `callbackStatus=${result.callbackStatus ?? "(none)"}`,
  );
  return result;
}

/**
 * Reads the subject's encrypted balance for the configured stablecoin.
 * Returns null when the account isn't yet registered or hasn't received any
 * deposits; otherwise returns the decrypted `bigint` balance.
 *
 * Subjects registered with `confidential: true` are in shared-mode — the
 * decrypt happens locally in this process via the subject's X25519 key
 * (no Arcium MPC round-trip). Fast.
 */
export async function getEncryptedBalance(
  subject: UmbraSubject,
  subjectId: string,
): Promise<bigint | null> {
  const client = await buildSubjectUmbraClient(subject, subjectId);
  const query = getEncryptedBalanceQuerierFunction({ client });
  const mintAddr = address(getStablecoinMint().toBase58());
  const result = await query([mintAddr]);
  const entry = result.get(mintAddr);
  if (!entry) return null;
  if (entry.state === "shared") return BigInt(entry.balance);
  // mxe / uninitialized / non_existent — caller should treat as zero / not
  // yet ready. The state distinction is mostly relevant for ops debugging.
  return null;
}

// ── Mixer (ETA → ETA) helpers ────────────────────────────────────────────────
//
// Why we route x402 spends through the mixer instead of a direct ETA→ETA hop:
//
//  - The SDK's high-level send-from-encrypted helpers go through the
//    receiver-claimable UTXO tree. There's no direct ETA→ETA top-level helper;
//    the codama-level instruction exists but is 24 accounts wide and a poor fit
//    for a hackathon timeline.
//  - The UTXO path gives strictly better privacy: the on-chain link between
//    sender ETA and recipient ETA goes through the mixer commitment tree, so
//    even an observer who watches Umbra accounts can't pair sender + recipient.
//
// The flow has two halves, separated by the Arcium MPC + Indexer + Relayer:
//
//   1. SENDER side (this process, on agent's behalf):
//        createReceiverClaimableUtxo(...) → produces a UTXO commitment in the
//        mixer tree, deducting the encrypted amount from the agent's ETA.
//        Returns a queue signature + (when finalized) a callback signature.
//   2. RECEIVER side (claim daemon, on merchant's behalf):
//        scanReceiverClaimableUtxos(...) → discovers UTXOs addressed to the
//        merchant by walking the indexer pages.
//        claimReceiverClaimableUtxos(...) → submits ZK-proven claim to relayer,
//        which lands the funds in the merchant's ETA encrypted balance.
//
// Both sides need ZK provers (Groth16). We use @umbra-privacy/web-zk-prover —
// works in node + browser; CPU-bound, ~30–90s per proof on a laptop. The
// receiver-claim path also needs a relayer to submit on the merchant's behalf
// without revealing the merchant's wallet.
//
// `UMBRA_INDEXER_URL` and `UMBRA_RELAYER_URL` must be set for these flows.
// Direct deposits/withdrawals don't need them, so they stay env-optional.

function requireIndexerEndpoint(): string {
  if (!env.UMBRA_INDEXER_URL) {
    throw new Error(
      "UMBRA_INDEXER_URL is required for mixer flows (UTXO scan/claim). " +
        "Set it in apps/web/.env.",
    );
  }
  return env.UMBRA_INDEXER_URL;
}

function requireRelayer(): IUmbraRelayer {
  if (!env.UMBRA_RELAYER_URL) {
    throw new Error(
      "UMBRA_RELAYER_URL is required for mixer claim flows. " +
        "Set it in apps/web/.env.",
    );
  }
  return getUmbraRelayer({ apiEndpoint: env.UMBRA_RELAYER_URL });
}

/**
 * Sender-side: deduct `amountMicros` from the sender's encrypted balance and
 * insert a UTXO commitment in the mixer tree addressed to `recipientEtaAddress`.
 *
 * Returns the SDK's `CreateUtxoFromEncryptedBalanceResult` which carries:
 *  - `createProofAccountSignature` (always present on success)
 *  - `queueSignature` (always)
 *  - `callbackStatus` + `callbackSignature` (when MPC callback monitoring
 *    resolved; only `'finalized'` indicates on-chain credit)
 *
 * Latency: ~10–25s on devnet — Groth16 prove (~30s on cold start, ~5s warm) +
 * 2–3 transaction round-trips + Arcium MPC callback. Recipient does NOT
 * receive funds in their ETA until they claim — there's no synchronous credit.
 *
 * **Recipient must already be Umbra-registered** (have a `userCommitment` on
 * chain). Our agent + merchant create flow registers eagerly, so this holds
 * for any subject_id that exists in our DB.
 */
export async function createReceiverClaimableUtxo(input: {
  fromSubject: UmbraSubject;
  fromSubjectId: string;
  recipientEtaAddress: string;
  amountMicros: bigint;
}): Promise<CreateUtxoFromEncryptedBalanceResult> {
  const mintBase58 = getStablecoinMint().toBase58();
  console.info(
    `[umbra/utxo-create] → SDK call from=${input.fromSubject}=${input.fromSubjectId} ` +
      `recipient=${input.recipientEtaAddress} mint=${mintBase58} ` +
      `amountMicros=${input.amountMicros}`,
  );
  const startedAt = Date.now();
  const client = await buildSubjectUmbraClient(
    input.fromSubject,
    input.fromSubjectId,
  );
  const zkProver = getCreateReceiverClaimableUtxoFromEncryptedBalanceProver();
  const createUtxo = getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction(
    { client },
    { zkProver },
  );
  const result = await createUtxo({
    // SDK's U64 is a branded bigint; the brand is for compile-time safety,
    // runtime accepts any bigint. Cast at the boundary, not at every caller.
    amount: input.amountMicros as U64,
    destinationAddress: address(input.recipientEtaAddress),
    mint: address(mintBase58),
  });
  console.info(
    `[umbra/utxo-create] ${input.fromSubject}=${input.fromSubjectId} ` +
      `took=${Date.now() - startedAt}ms ` +
      `proofSig=${result.createProofAccountSignature} ` +
      `queueSig=${result.queueSignature} ` +
      `callbackSig=${result.callbackSignature ?? "(none)"} ` +
      `callbackStatus=${result.callbackStatus ?? "(none)"}`,
  );
  return result;
}

/**
 * Receiver-side scan: walk the mixer tree at `treeIndex` from
 * `startInsertionIndex` looking for UTXOs addressed to this subject. Returns
 * only the `received` slice — UTXOs that another sender created via the ETA
 * receiver-claimable path. Other categories (`selfBurnable`, public variants)
 * are ignored.
 *
 * The indexer is untrusted; the SDK will verify Merkle proofs before claim.
 *
 * Caller is responsible for persisting `nextScanStartIndex` between runs so
 * the daemon doesn't re-scan the entire tree every poll.
 */
export async function scanReceiverClaimableUtxos(input: {
  subject: UmbraSubject;
  subjectId: string;
  treeIndex: number;
  startInsertionIndex: number;
}): Promise<{
  received: ScannedUtxoData[];
  nextScanStartIndex: number;
}> {
  requireIndexerEndpoint();
  console.info(
    `[umbra/utxo-scan] → SDK call ${input.subject}=${input.subjectId} ` +
      `tree=${input.treeIndex} start=${input.startInsertionIndex}`,
  );
  const startedAt = Date.now();
  const client = await buildSubjectUmbraClient(input.subject, input.subjectId);
  const scan = getClaimableUtxoScannerFunction({ client });
  // The SDK uses U32 branded types backed by bigints. Pass BigInts, not
  // numbers — the SDK's internal `treeIndex * 1_048_576n` throws
  // "Cannot mix BigInt and other types" otherwise.
  const result = await scan(
    BigInt(input.treeIndex) as unknown as Parameters<typeof scan>[0],
    BigInt(input.startInsertionIndex) as unknown as Parameters<typeof scan>[1],
  );
  console.info(
    `[umbra/utxo-scan] ${input.subject}=${input.subjectId} ` +
      `took=${Date.now() - startedAt}ms ` +
      `received=${result.received.length} ` +
      `selfBurnable=${result.selfBurnable.length} ` +
      `next=${result.nextScanStartIndex}`,
  );
  return {
    received: result.received,
    nextScanStartIndex: Number(result.nextScanStartIndex),
  };
}

/**
 * Receiver-side claim: take a list of UTXOs (from `scanReceiverClaimableUtxos`)
 * and convert them into the subject's encrypted balance via the relayer. The
 * relayer pays the on-chain fee + signs the claim tx — keeps the merchant's
 * wallet off the on-chain trail.
 *
 * No-op + returns an empty `batches` map when `utxos` is empty (avoids a
 * pointless relayer round-trip when the daemon polls and finds nothing).
 */
export async function claimReceiverClaimableUtxos(input: {
  subject: UmbraSubject;
  subjectId: string;
  utxos: readonly ScannedUtxoData[];
}): Promise<ClaimUtxoIntoEncryptedBalanceResult> {
  if (input.utxos.length === 0) {
    return { batches: new Map() };
  }
  console.info(
    `[umbra/utxo-claim] → SDK call ${input.subject}=${input.subjectId} ` +
      `utxos=${input.utxos.length}`,
  );
  const startedAt = Date.now();
  requireIndexerEndpoint();
  const client = await buildSubjectUmbraClient(input.subject, input.subjectId);
  if (!client.fetchBatchMerkleProof) {
    throw new Error(
      "Umbra client missing fetchBatchMerkleProof — UMBRA_INDEXER_URL is set " +
        "but the SDK didn't wire the proof fetcher. Verify the URL is reachable.",
    );
  }
  const relayer = requireRelayer();
  const zkProver = getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver();
  const claim = getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction(
    { client },
    {
      fetchBatchMerkleProof: client.fetchBatchMerkleProof,
      zkProver,
      relayer: {
        submitClaim: relayer.submitClaim,
        pollClaimStatus: relayer.pollClaimStatus,
        getRelayerAddress: relayer.getRelayerAddress,
      },
    },
  );
  const result = await claim(input.utxos);
  console.info(
    `[umbra/utxo-claim] ${input.subject}=${input.subjectId} ` +
      `took=${Date.now() - startedAt}ms batches=${result.batches.size}`,
  );
  return result;
}
