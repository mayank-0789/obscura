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
} from "@umbra-privacy/sdk/interfaces";
import type { U64 } from "@umbra-privacy/sdk/types";
import {
  getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver,
  getCreateReceiverClaimableUtxoFromEncryptedBalanceProver,
  getUserRegistrationProver,
} from "@umbra-privacy/web-zk-prover";
import { env } from "@/lib/env";
import { getConnection, getStablecoinMint, getTreasury } from "@/lib/solana";

export type UmbraSubject = "agent" | "merchant";

// `v1` bump rotates every subject key. Trailing pipe is a delimiter that
// prevents HMAC prefix collisions across IDs.
const DOMAIN_SEPARATOR_PREFIX = "umbra/v1/" as const;

// Truncate ETA addresses in logs — full addresses would leak recipient identity.
function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…`;
}

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

/** Pure derivation of the Umbra-side base58 pubkey. No I/O, safe inside a DB batch. */
export function deriveSubjectEtaAddress(
  subject: UmbraSubject,
  subjectId: string,
): string {
  return deriveKeypair(subject, subjectId).publicKey.toBase58();
}

export const deriveAgentEtaAddress = (agentId: string) =>
  deriveSubjectEtaAddress("agent", agentId);
export const deriveMerchantEtaAddress = (merchantId: string) =>
  deriveSubjectEtaAddress("merchant", merchantId);

async function getSubjectSigner(
  subject: UmbraSubject,
  subjectId: string,
): Promise<IUmbraSigner> {
  return createSignerFromPrivateKeyBytes(
    deriveKeypair(subject, subjectId).secretKey,
  );
}

// Most providers mirror HTTP at wss:// on the same path; env override for proxies.
function resolveRpcSubscriptionsUrl(): string {
  if (env.UMBRA_RPC_SUBSCRIPTIONS_URL) return env.UMBRA_RPC_SUBSCRIPTIONS_URL;
  return env.HELIUS_RPC_URL.replace(/^https?:\/\//, "wss://");
}

/** Per-subject Umbra client. Not cached — derivation is cheap. */
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

/** Treasury client, cached process-wide. Rejection clears cache so a transient boot failure doesn't poison the singleton. */
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
  const signer = await createSignerFromPrivateKeyBytes(treasury.secretKey);
  return getUmbraClient({
    signer,
    network: env.UMBRA_NETWORK,
    rpcUrl: env.HELIUS_RPC_URL,
    rpcSubscriptionsUrl: resolveRpcSubscriptionsUrl(),
    indexerApiEndpoint: env.UMBRA_INDEXER_URL,
  });
}

/**
 * Idempotent — SDK skips already-completed steps. Both flags required:
 * `confidential` for direct deposits, `anonymous` for the mixer (Umbra
 * error 18003 fires on either side without it).
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

const SUBJECT_UMBRA_SOL_TARGET = 0.05 * LAMPORTS_PER_SOL;

/** Top up subject from treasury so it can pay its own registration fees. Idempotent. */
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

/** Treasury → encrypted balance. Only `callbackStatus = 'finalized'` is a confirmed success; other states are uncertain. */
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

/** Subject's encrypted balance, or null when not registered/funded. */
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
  return null;
}

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
 * Sender-side mixer hop: debit sender, insert UTXO addressed to recipient.
 * Recipient must already be Umbra-registered. Only `callbackStatus =
 * 'finalized'` confirms on-chain credit.
 */
export async function createReceiverClaimableUtxo(input: {
  fromSubject: UmbraSubject;
  fromSubjectId: string;
  recipientEtaAddress: string;
  amountMicros: bigint;
}): Promise<CreateUtxoFromEncryptedBalanceResult> {
  const mintBase58 = getStablecoinMint().toBase58();
  // Privacy: never log full recipient ETA or exact amount (mixer threat model).
  console.info(
    `[umbra/utxo-create] → SDK call from=${input.fromSubject}=${input.fromSubjectId} ` +
      `recipient=${shortAddr(input.recipientEtaAddress)} mint=${mintBase58}`,
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

/** Receiver-side scan from `startInsertionIndex`. Caller persists `nextScanStartIndex`. */
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
  // SDK's internal `treeIndex * 1_048_576n` requires BigInt — number throws.
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

/** Receiver-side claim via relayer. No-op when `utxos` is empty. */
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
