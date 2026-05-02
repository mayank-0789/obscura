# Obscura

**Confidential pay-per-call payments for AI agents on Solana, built on the [Umbra Privacy](https://umbraprivacy.com) protocol.**

Obscura turns the [x402](https://github.com/coinbase/x402) HTTP standard into a privacy-preserving rail: agents pay merchants per API call from an encrypted balance, the on-chain link between sender and receiver is broken by Umbra's mixer, and the transferred amount is hidden. Merchants integrate with one Express middleware; agent developers integrate with one fetch wrapper.

> Submitted to the [Umbra Privacy track](https://umbraprivacy.com) of the **Colosseum Solana Frontier Hackathon, 2026**.

---

## Table of contents

1. [What problem this solves](#what-problem-this-solves)
2. [Quick demo](#quick-demo)
3. [Architecture overview](#architecture-overview)
4. [Umbra integration — deep dive](#umbra-integration--deep-dive)
   - [Identity and key derivation](#1-identity-and-key-derivation)
   - [Subject registration on Umbra](#2-subject-registration-on-umbra)
   - [Direct deposits — treasury → encrypted balance](#3-direct-deposits--treasury--encrypted-balance)
   - [Mixer transfers — agent → merchant (Path B)](#4-mixer-transfers--agent--merchant-path-b)
   - [Receiver claim daemon](#5-receiver-claim-daemon)
   - [Encrypted balance reads](#6-encrypted-balance-reads)
   - [Withdrawals](#7-withdrawals)
   - [Reconciliation](#8-reconciliation)
5. [End-to-end flows](#end-to-end-flows)
6. [The two SDKs](#the-two-sdks)
7. [Repo structure](#repo-structure)
8. [Running locally](#running-locally)
9. [Deployment](#deployment)
10. [Security model](#security-model)
11. [Hackathon submission](#hackathon-submission)

---

## What problem this solves

x402 is a recently-popular HTTP standard for pay-per-call APIs: a merchant returns `402 Payment Required` with a payment challenge, the agent pays on-chain, retries with proof, gets the resource. It's a clean rail. But the on-chain settlement is a public SPL transfer — every observer sees who paid whom and how much.

For agents that pay across hundreds of merchants per day (data feeds, LLM inference, MCP servers, paid scrapers), this leaks:

- **Strategy** — competitors can map an agent's API consumption.
- **Volume** — payment amounts are public.
- **Counterparties** — the social graph of agent ↔ merchant relationships is on-chain.

**Obscura replaces the public SPL transfer in x402 with a confidential Umbra mixer transfer.** Same x402 protocol surface, same merchant integration ergonomics. But:

- The agent's actual wallet **is never on-chain** — payments come from its derived Umbra encrypted account (ETA).
- The payment amount **is encrypted** — the on-chain UTXO commitment hides it.
- The link between sender ETA and receiver ETA **goes through the mixer commitment tree** — even an observer who indexes Umbra accounts cannot pair sender and receiver.
- Merchant earnings settle into **their own encrypted balance** — only the merchant can decrypt their books.

The Obscura backend is the only party that ever sees plaintext amounts, and it's the agent operator's own backend. Third parties — including Umbra itself, the relayer, and the indexer — see only commitments and ZK proofs.

---

## Quick demo

- **Live demo:** `https://obscurapp.com/demo` *(once deployed)* — judge clicks one button to fire a real x402 transaction on Solana devnet via the Umbra mixer, watches each step stream live, gets a Solscan link to verify on-chain.
- **Agent SDK demo:** `apps/demo-agent/` — a small Node script that loops forever (Ctrl-C to stop), hitting `apps/demo-merchant-news/` once every ~25s with a mix of `/headlines` ($0.005), `/article/:id` ($0.010), and an occasional `/digest` ($0.015). Run end-to-end via `pnpm dev:demo` + `cd apps/demo-agent && pnpm start`.
- **Demo video:** *(submitted alongside this README)*

---

## Architecture overview

```
                         ┌─────────────────────────────────────┐
                         │            HUMANS                   │
                         │                                     │
                         │  agent-developer ──┐                │
                         │                    │                │
                         │              merchant ──┐           │
                         └────────────────────┼────┼───────────┘
                                              │    │
                                              ▼    ▼
   ┌─────────────────────────────────────────────────────────────────┐
   │  OBSCURA WEB APP (apps/web — Next.js 16, deployed on Railway)   │
   │                                                                 │
   │   ─ /dashboard, /agents, /topup, /merchants/* (UI)              │
   │   ─ /api/agents (provisioning), /api/merchants (provisioning)   │
   │   ─ /api/topup/session, /api/webhooks/dodo (fiat in)            │
   │   ─ /api/x402/sign  ◄── HOT PATH for confidential agent pay     │
   │   ─ /api/cron/claim-daemon  (every 2 min, claims merchant UTXOs)│
   │   ─ /api/cron/reconcile     (every 5 min, repairs stuck txs)    │
   │   ─ Drizzle ORM + Neon Postgres (transactions table = audit log)│
   └─────────┬──────────────────┬──────────────────┬─────────────────┘
             │                  │                  │
             ▼                  ▼                  ▼
   ┌─────────────────┐  ┌────────────────┐  ┌────────────────────────┐
   │  Solana devnet  │  │ Umbra Indexer  │  │  Umbra Relayer         │
   │  (Helius RPC)   │  │ (UMBRA_INDEXER_│  │  (UMBRA_RELAYER_URL)   │
   │   ─ ETA accts   │  │  URL)          │  │   ─ submits claims     │
   │   ─ mixer tree  │  │  ─ scan UTXOs  │  │     on merchant's      │
   │   ─ Arcium MPC  │  │  ─ Merkle      │  │     behalf (relayer    │
   │     callbacks   │  │    proofs      │  │     pays gas, signs)   │
   └─────────────────┘  └────────────────┘  └────────────────────────┘
                                                        ▲
                                                        │
                                              ┌─────────┴─────────┐
                                              │ AGENT SDK         │
                                              │ (@obscura-app/sdk)│
                                              │                   │
                                              │ ─ wraps fetch     │
                                              │ ─ handles 402     │
                                              │ ─ posts to        │
                                              │  /api/x402/sign   │
                                              └───────────────────┘
                                                        │
                                                        ▼
                                              ┌────────────────────────┐
                                              │ MERCHANT SDK           │
                                              │(@obscura-app/merchant- │
                                              │  sdk)                  │
                                              │                        │
                                              │ ─ Express middleware   │
                                              │ ─ issues 402 challenge │
                                              │ ─ verifies on-chain    │
                                              │   via Solana RPC       │
                                              └────────────────────────┘
```

---

## Umbra integration — deep dive

This is the section the privacy-track judges should read carefully. Every Umbra SDK function we call, where it's called from, and why.

The bulk of the Umbra integration lives in **`apps/web/lib/umbra.ts`** (~605 lines). Two carve-outs intentionally import the SDK directly: `apps/web/app/api/cron/claim-daemon/route.ts` (scanner + claimer + relayer + claim prover, kept self-contained so the cron has no extra module graph) and `apps/web/app/api/webhooks/dodo/route.ts` (`assertU64` for the deposit amount brand). Anywhere else, fold imports back through `lib/umbra.ts`.

### 1. Identity and key derivation

Umbra requires every participant — agent, merchant, treasury — to have its own keypair. Storing N keypairs alongside N database rows would be a single point of compromise. Instead, we derive every Umbra keypair on demand from a single env-stored master secret.

**File: `apps/web/lib/umbra.ts:81-113`**

```ts
const DOMAIN_SEPARATOR_PREFIX = "umbra/v1/" as const;

function buildDomainSeparator(subject: "agent" | "merchant"): string {
  return `${DOMAIN_SEPARATOR_PREFIX}${subject}-signing-key|`;
}

function deriveSeed(subject, subjectId): Uint8Array {
  const mac = createHmac("sha256", env.UMBRA_AGENT_SEED_SECRET);
  mac.update(buildDomainSeparator(subject));
  mac.update(subjectId);
  return mac.digest();  // 32 bytes
}

function deriveKeypair(subject, subjectId): Keypair {
  return Keypair.fromSeed(deriveSeed(subject, subjectId));
}

export const deriveAgentEtaAddress = (agentId: string) =>
  deriveKeypair("agent", agentId).publicKey.toBase58();
export const deriveMerchantEtaAddress = (merchantId: string) =>
  deriveKeypair("merchant", merchantId).publicKey.toBase58();
```

**Why HMAC, not direct hash?** HMAC's key-input separation makes "given subject+ID, produce seed" non-invertible without the master secret. An attacker who breaches our DB and gets every `agentId` cannot reconstruct any keypair without `UMBRA_AGENT_SEED_SECRET`.

**Why domain separation by subject type?** `agents.id` and `merchants.id` are both UUIDs from independent generators. Without domain separation, a deliberate-collision attack (engineer two records that hash to the same seed) would let one party spend from another's encrypted balance. The `umbra/v1/agent-signing-key|` vs `umbra/v1/merchant-signing-key|` prefix prevents collision.

**Why version `v1`?** Bumping to `v2` rotates every key. We never plan to do this in production, but the migration plan exists.

The derived `etaAddress` is the **on-chain Solana pubkey** of the subject's Umbra account. It's persisted in the `agents.eta_address` and `merchants.eta_address` columns, but only as a cache — the truth is always re-derivable.

### 2. Subject registration on Umbra

Before a subject can deposit, send, or receive anything, it must be registered on Umbra in **two simultaneous modes**:

- **`confidential: true`** — creates the X25519 key needed for direct deposits and decryption of the subject's own encrypted balance.
- **`anonymous: true`** — registers the user commitment used by the mixer. **Required on both sender AND receiver** before any ETA→ETA mixer transfer.

We discovered the dual-mode requirement empirically — the SDK throws Umbra error `18003` (`ENCRYPTED_USER_ACCOUNT_IS_ACTIVE_FOR_ANONYMOUS_USAGE_BIT_MUST_BE_SET`) without `anonymous: true` set on both ends.

**File: `apps/web/lib/umbra.ts:218-236`**

```ts
import {
  getUserRegistrationFunction,
} from "@umbra-privacy/sdk";
import {
  getUserRegistrationProver,
} from "@umbra-privacy/web-zk-prover";

export async function registerSubjectOnUmbra(
  subject: UmbraSubject,
  subjectId: string,
): Promise<string[]> {
  const client = await buildSubjectUmbraClient(subject, subjectId);
  const register = getUserRegistrationFunction(
    { client },
    { zkProver: getUserRegistrationProver() },
  );
  const signatures = await register({ confidential: true, anonymous: true });
  return signatures.map((s) => String(s));
}
```

The anonymous step requires a Groth16 ZK proof — supplied by `getUserRegistrationProver()` from `@umbra-privacy/web-zk-prover`. Cold-cache prove time on a laptop: ~30s. Warm: ~5s. Idempotent on re-call: the SDK reads the on-chain status bits per step and skips work that's already done.

**Where this is called from:**

- `apps/web/app/api/agents/route.ts` — agent creation flow
- `apps/web/lib/merchants.ts` — merchant provisioning (`createMerchantWallet`)

Before registering, we lazy-fund the subject's derived address with ~0.05 SOL from the treasury so it can pay its own three registration transactions. See `fundSubjectAddressIfNeeded` (`apps/web/lib/umbra.ts:251-273`).

### 3. Direct deposits — treasury → encrypted balance

When a user tops up their agent via Dodo (fiat → INR → USDC equivalent), the Dodo webhook handler receives `payment.succeeded`, parses the metadata, and calls our deposit helper to credit the agent's encrypted balance.

**File: `apps/web/lib/umbra.ts:303-329`**

```ts
import {
  getPublicBalanceToEncryptedBalanceDirectDepositorFunction,
} from "@umbra-privacy/sdk";

export async function depositTreasuryToEncryptedAccount(input: {
  etaAddress: string;
  amountMicros: bigint;
}): Promise<DepositResult> {
  const client = await getTreasuryUmbraClient();
  const deposit = getPublicBalanceToEncryptedBalanceDirectDepositorFunction({
    client,
  });
  const result = await deposit(
    address(input.etaAddress),
    address(getStablecoinMint().toBase58()),
    input.amountMicros as U64,
  );
  return result;
}
```

This is a **direct deposit** — the deposit event is publicly visible on chain (sender, recipient, mint, gross amount), but the resulting encrypted balance value is hidden. The trade-off: the top-up source (Dodo → treasury) is naturally public anyway because it touches fiat-to-crypto rails; only the agent's *spending pattern* needs hiding.

**Caller:** `apps/web/app/api/webhooks/dodo/route.ts` (the Dodo `payment.succeeded` handler).

The returned `DepositResult` carries:
- `queueSignature` — the Solana tx that submitted the deposit
- `callbackSignature` — Arcium MPC's confirmation tx (when finalized)
- `callbackStatus` — `"finalized"` is the only success state

We persist all three on the corresponding `transactions` row (`kind='topup'`).

### 4. Mixer transfers — agent → merchant (Path B)

This is the **hot path** — what runs every time an agent pays a merchant via x402.

There are two paths Umbra exposes for ETA → ETA confidential transfer:

| Path | What | Privacy | Why we picked Path B |
|---|---|---|---|
| **A** | Direct ETA → ETA via codama-level instruction | Tier-2 (sender / recipient pubkeys still linkable on-chain) | 24-account manual wiring; SDK does not expose a high-level helper |
| **B** | Sender → mixer commitment tree → recipient claims | **Tier-1** (sender + recipient unlinkable through the mixer) | Cleanest helpers; strictly stronger privacy; aligns with the privacy-track thesis |

Latency cost of Path B: ~10–25s per transfer (Groth16 prove + Arcium MPC callback). Acceptable for x402 single-call payments (which typically deliver multi-second-of-LLM-work APIs anyway), unsuitable for sub-cent streaming.

**File: `apps/web/lib/umbra.ts:462-504`**

```ts
import {
  getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction,
} from "@umbra-privacy/sdk";
import {
  getCreateReceiverClaimableUtxoFromEncryptedBalanceProver,
} from "@umbra-privacy/web-zk-prover";

export async function createReceiverClaimableUtxo(input: {
  fromSubject: UmbraSubject;
  fromSubjectId: string;
  recipientEtaAddress: string;
  amountMicros: bigint;
}): Promise<CreateUtxoFromEncryptedBalanceResult> {
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
    mint: address(getStablecoinMint().toBase58()),
  });
  return result;
}
```

The function:
1. Decrypts the sender's encrypted balance locally (X25519 key, no MPC).
2. Generates a Groth16 proof that the sender has enough balance and the new commitment is well-formed (~10s warm, ~30s cold).
3. Submits the queue transaction — encrypted balance debit + UTXO insertion.
4. Waits for Arcium MPC to validate and emit a callback transaction.
5. Returns `{ proofSignature, queueSignature, callbackSignature, callbackStatus }`.

**Caller:** `apps/web/app/api/x402/sign/route.ts:259` — the x402 payment-signing route.

**Critical contract:** we refuse to issue the agent's `umbra-mixer-v1` payment header unless `callbackStatus === "finalized"` (`apps/web/app/api/x402/sign/route.ts:290-305`). A non-finalized callback means the encrypted balance debit may have landed but Arcium hasn't confirmed; the cap is left incremented (so the agent can't double-spend), the row stays `pending`, and the reconciler later resolves it.

### 5. Receiver claim daemon

UTXOs sitting in the mixer tree don't automatically credit the recipient — the recipient must scan and claim them. The Obscura backend runs this on the merchant's behalf via a scheduled cron service.

**Files involved:**
- `apps/web/lib/umbra.ts:518-605` — scan + claim helpers
- `apps/web/app/api/cron/claim-daemon/route.ts` — the cron entrypoint

#### Scan: walk the mixer tree, find UTXOs addressed to this merchant

**`apps/web/lib/umbra.ts:518-553`**

```ts
import { getClaimableUtxoScannerFunction } from "@umbra-privacy/sdk";

export async function scanReceiverClaimableUtxos(input: {
  subject: UmbraSubject;
  subjectId: string;
  treeIndex: number;
  startInsertionIndex: number;
}) {
  const client = await buildSubjectUmbraClient(input.subject, input.subjectId);
  const scan = getClaimableUtxoScannerFunction({ client });
  const result = await scan(
    BigInt(input.treeIndex) as ...,
    BigInt(input.startInsertionIndex) as ...,
  );
  return {
    received: result.received,
    nextScanStartIndex: Number(result.nextScanStartIndex),
  };
}
```

The scanner walks the on-chain mixer tree from a `(treeIndex, startInsertionIndex)` cursor, decrypting commitment leaves with the merchant's key. Returns only the `received` slice — UTXOs addressed to this merchant via the receiver-claimable path. Other categories (`selfBurnable`, public variants) are ignored.

**Note on the SDK's branded types:** the `treeIndex` and `startInsertionIndex` parameters are typed as `U32` (a brand on `bigint`, not `number`). Passing a JS `number` throws `Cannot mix BigInt and other types` at runtime — caught during validation, fixed with `BigInt(...)`.

#### Claim: produce ZK proof and submit through the relayer

**`apps/web/lib/umbra.ts:564-605`**

```ts
import {
  getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction,
  getUmbraRelayer,
} from "@umbra-privacy/sdk";
import {
  getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver,
} from "@umbra-privacy/web-zk-prover";

export async function claimReceiverClaimableUtxos(input: {
  subject: UmbraSubject;
  subjectId: string;
  utxos: readonly ScannedUtxoData[];
}): Promise<ClaimUtxoIntoEncryptedBalanceResult> {
  const client = await buildSubjectUmbraClient(input.subject, input.subjectId);
  const relayer = getUmbraRelayer({ apiEndpoint: env.UMBRA_RELAYER_URL });
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
  return result;
}
```

The relayer is critical here: **it pays the on-chain claim fee + signs the claim transaction.** The merchant's wallet never appears as fee payer on chain. This keeps the merchant's actual wallet off the on-chain trail entirely — only the encrypted balance accumulates, and only the merchant can decrypt it.

The Groth16 prove time per claim is ~30s. The cron service runs every 2 minutes and processes up to 2 merchants per invocation (bounded so a single claim run doesn't exceed any deadline cap).

#### The cron service

**`apps/web/app/api/cron/claim-daemon/route.ts`** — gated by `cronAuthGuard` (Bearer token), runs every 2 minutes. Pseudocode:

```ts
const merchants = await db.select().from(merchants)
  .where(eq(merchants.umbraStatus, "active"))
  .limit(2);

for (const m of merchants) {
  const client = await buildSubjectUmbraClient("merchant", m.id);
  const scanResult = await scan(0n, 0n);  // scan from start; nullifier check filters spent UTXOs
  if (scanResult.received.length === 0) continue;
  await claim(scanResult.received);
}
```

Notes on this implementation:

- **No persistent scan cursor.** Without a Redis or filesystem cursor we always scan from `(0, 0)`. The relayer rejects double-claims at submit (nullifier already spent → revert), so correctness is maintained but we do redundant work. Logged in known limitations; fixable with Redis.
- **Idempotency.** Submitting the same UTXO claim twice fails on-circuit at the second submission. Safe under serverless cold-start retries.

### 6. Encrypted balance reads

For the agent dashboard, the agent's encrypted balance is decrypted **locally in the Obscura process** using the X25519 key. No MPC round-trip — fast.

**File: `apps/web/lib/umbra.ts:376-390`**

```ts
import { getEncryptedBalanceQuerierFunction } from "@umbra-privacy/sdk";

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
```

The `state === "shared"` check is the SDK's signal that the per-mint encrypted balance account exists, has been funded, and is in a state we can decrypt locally. Other states (`"mxe"`, `"uninitialized"`, `"non_existent"`) all map to "treat as zero" from the dashboard's perspective.

**Callers:**

- `apps/web/app/api/x402/sign/route.ts:180` — pre-flight balance check before the expensive mixer prove. Saves ~20s when the agent simply doesn't have funds.
- `apps/web/app/api/agents/[id]/balance/route.ts` — dashboard live-balance polling.

### 7. Withdrawals

Merchants and operators can move funds from their encrypted balance back to a public SPL token account. Used for cash-out flows (planned) and operator emergency drains (built).

**File: `apps/web/lib/umbra.ts:335-365`**

```ts
import {
  getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction,
} from "@umbra-privacy/sdk";

export async function withdrawFromEncryptedAccount(input: {
  subject: UmbraSubject;
  subjectId: string;
  destinationAddress: string;
  amountMicros: bigint;
}): Promise<WithdrawResult> {
  const client = await buildSubjectUmbraClient(input.subject, input.subjectId);
  const withdraw = getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction({
    client,
  });
  const result = await withdraw(
    address(input.destinationAddress),
    address(getStablecoinMint().toBase58()),
    input.amountMicros as U64,
  );
  return result;
}
```

Like deposits, this is a direct (non-mixer) operation. The withdrawal *event* is on-chain; only the prior encrypted balance state stays hidden. Fine for end-of-day cash-out: by the time the merchant withdraws, the per-call payment graph is already protected.

### 8. Reconciliation

Some Umbra mixer transfers will resolve in an indeterminate state — queue tx landed, MPC callback didn't fire within the SDK's monitor window. We can't tell from inside the SDK whether the encrypted balance debit happened. We CAN check the queue tx's success on-chain via Helius RPC.

**File: `apps/web/app/api/cron/reconcile/route.ts`** — runs every 5 minutes.

```ts
// Pull pending spend rows older than 120s but younger than 24h
const candidates = await db.select(...).from(transactions).where(
  status='pending' AND kind='spend' AND queue_signature IS NOT NULL
  AND callback_signature IS NULL
);

for (const row of candidates) {
  const txInfo = await connection.getTransaction(row.queueSignature);
  if (!txInfo) continue;  // not yet visible — try next tick
  if (txInfo.meta?.err) {
    // queue tx failed → mark failed + revert cap
  } else {
    // queue tx succeeded → mark confirmed
  }
}
```

This is **not** an Umbra SDK call — it's a Solana RPC call to verify the queue tx — but it's part of how we keep the off-chain audit log (`transactions` table) consistent with Umbra's on-chain state.

---

## End-to-end flows

### Flow 1 — User onboarding (one-time, per agent)

```
USER                    OBSCURA WEB                SOLANA / UMBRA
  │                          │                            │
  │  1. Sign in (NextAuth)   │                            │
  │ ────────────────────────►│                            │
  │                          │                            │
  │  2. Create agent         │                            │
  │ ────────────────────────►│                            │
  │                          │  3. deriveAgentEtaAddress  │
  │                          │     (HMAC + master seed)   │
  │                          │                            │
  │                          │  4. fundSubjectAddress     │
  │                          │ ──────────────────────────►│  (treasury sends ~0.05 SOL)
  │                          │                            │
  │                          │  5. registerSubjectOnUmbra │
  │                          │     {confidential, anon}   │
  │                          │ ──────────────────────────►│  (Groth16 prove + 3 txs)
  │                          │                            │
  │                          │  6. INSERT agents +        │
  │                          │     budgets + api_keys     │
  │  7. API key revealed once│                            │
  │◄─────────────────────────│                            │
  │                          │                            │
```

### Flow 2 — Top-up (fiat → encrypted balance)

```
USER         OBSCURA WEB           DODO              SOLANA / UMBRA
  │              │                  │                      │
  │  1. /topup   │                  │                      │
  │ ────────────►│                  │                      │
  │              │  2. Create Dodo  │                      │
  │              │  checkout session│                      │
  │              │ ────────────────►│                      │
  │              │ ◄────checkout url│                      │
  │ ◄────────────│                  │                      │
  │              │                  │                      │
  │ ── pays in UPI/card via Dodo ──►│                      │
  │              │                  │                      │
  │              │ ◄─ payment.succeeded webhook            │
  │              │  3. depositTreasuryToEncryptedAccount   │
  │              │ ──────────────────────────────────────►│
  │              │                            (queue tx + Arcium callback)
  │              │ ◄───── DepositResult (queueSig + callbackSig + status) ───
  │              │                  │                      │
  │              │  4. INSERT transactions(kind='topup',   │
  │              │       status='confirmed', sigs)         │
  │              │                  │                      │
  │  5. Dashboard reads encrypted balance                  │
  │     via getEncryptedBalance → shows new amount         │
  │ ◄────────────│                  │                      │
```

### Flow 3 — Agent pays merchant (the privacy-critical path)

```
AGENT CODE      AGENT SDK    OBSCURA WEB    UMBRA / SOLANA    MERCHANT API
                                                              (with merchant SDK)
    │                │             │              │              │
    │ agent.fetch    │             │              │              │
    │  (merchantUrl) │             │              │              │
    │ ──────────────►│             │              │              │
    │                │  1. GET (merchantUrl)                    │
    │                │ ────────────────────────────────────────►│
    │                │                            ┌────────────│
    │                │                            │ no payment │
    │                │                            │ → 402 +    │
    │                │ ◄──────────────────────────│ x402       │
    │                │                            │ challenge  │
    │                │                                          │
    │                │  2. POST /api/x402/sign                  │
    │                │     (Bearer api-key)                     │
    │                │ ───────────►│              │              │
    │                │             │ ─ atomic cap-check         │
    │                │             │ ─ getEncryptedBalance      │
    │                │             │   (precheck)               │
    │                │             │ ─ insert pending tx        │
    │                │             │ ─ createReceiverClaimable  │
    │                │             │   Utxo:                    │
    │                │             │ ────────────►│ Groth16     │
    │                │             │              │ prove ~10s  │
    │                │             │              │ → queue tx  │
    │                │             │              │ → MPC       │
    │                │             │              │   callback  │
    │                │             │ ◄────────────│ finalized   │
    │                │             │ ─ update tx confirmed       │
    │                │             │ ─ encode umbra-mixer-v1    │
    │                │             │   envelope                 │
    │                │ ◄paymentSig │              │              │
    │                │                                          │
    │                │  3. GET (merchantUrl)                    │
    │                │     PAYMENT-SIGNATURE: <umbra-mixer-v1 envelope>│
    │                │ ────────────────────────────────────────►│
    │                │                            ┌────────────│
    │                │                            │ verify     │
    │                │                            │ envelope   │
    │                │                            │ on-chain   │
    │                │                            │ via RPC:   │
    │                │                            │  ─ queueSig│
    │                │                            │  ─ payTo== │
    │                │                            │    self    │
    │                │                            │  ─ asset   │
    │                │                            │  ─ replay  │
    │                │                            │    window  │
    │                │ ◄──────────────────────────│ 200 + body │
    │ ◄ Response ────│                                          │
    │  (json)        │                                          │
```

Some time later (within 2 minutes):

```
RAILWAY CRON              OBSCURA WEB            UMBRA INDEXER         UMBRA RELAYER
                                                                       (devnet relayer)
     │                          │                       │                    │
     │ ─ every 2 min ───────────►/api/cron/claim-daemon │                    │
     │                          │                       │                    │
     │                          │ for active merchants: │                    │
     │                          │  scanReceiverClaimable│                    │
     │                          │ ──────────────────────►                    │
     │                          │ ◄──────  UTXOs received                    │
     │                          │  claimReceiverClaimable                    │
     │                          │ ─ Groth16 claim proof ~30s                 │
     │                          │ ─ submit batch ─────────────────────────►  │
     │                          │ ◄────────────────────── relayer pays gas + │
     │                          │                         signs claim tx     │
     │                          │     ↳ merchant's encrypted balance         │
     │                          │       credited on chain                    │
```

### Flow 4 — Merchant withdraws (planned)

Not implemented in v1; uses `withdrawFromEncryptedAccount` to move from the merchant's encrypted balance to a public SPL ATA, then a separate fiat off-ramp (Mudrex + Dodo Payouts) handles INR delivery.

---

## The two SDKs

### `@obscura-app/sdk` — for agent developers

5-line integration. Wraps `fetch`, handles 402 transparently.

```ts
import { Obscura } from "@obscura-app/sdk";

const agent = new Obscura({
  apiKey: process.env.OBSCURA_KEY!,
  baseUrl: process.env.OBSCURA_BASE_URL!,
});

const res = await agent.fetch("https://news-api.com/headlines");
const json = await res.json();
```

What it does internally:
1. First fetch — if response isn't 402, return as-is.
2. On 402, read `PAYMENT-REQUIRED` header.
3. POST to `${baseUrl}/api/x402/sign` with the challenge + Bearer api-key.
4. Receive base64 `umbra-mixer-v1` envelope.
5. Retry the original fetch with `PAYMENT-SIGNATURE: <envelope>`.

Public surface: `Obscura`, `ObscuraError`, `ObscuraErrorCode`, `ObscuraOptions`. Errors carry typed codes (`over_cap`, `insufficient_funds`, `signing_failed`, `network_error`, `timeout`, etc.). Auto-retry policy: exponential backoff on transient errors only; terminal errors (`over_cap`, `conflict`, `invalid_token`, `signing_failed`, `timeout`) fail fast — the last two are terminal because the in-flight request may have already initiated an on-chain transfer and a retry would risk a second debit.

### `@obscura-app/merchant-sdk` — for API sellers

3-line integration with Express:

```ts
import express from "express";
import { obscura } from "@obscura-app/merchant-sdk";

const pay = obscura({
  merchantEtaAddress: process.env.MERCHANT_ETA_ADDRESS!,
  network: "solana-devnet",
  rpcUrl: process.env.HELIUS_RPC_URL,
});

const app = express();
app.get("/article/:id", pay.charge({ amount: "10000" }), (req, res) => {
  res.json({ article: "..." });
});
```

What it does internally:
1. **No payment header** → respond with 402 + `PAYMENT-REQUIRED` containing the merchant's ETA address as `payTo`.
2. **Payment header present** → decode the `umbra-mixer-v1` envelope, fetch `queueSignature` via Solana RPC, verify:
   - The tx came from a registered Umbra subject.
   - It targets this merchant's ETA address.
   - The mint matches.
   - The replay window (5 min default) hasn't elapsed.
3. On success: attach `X-Payment-Response` settlement header, call `next()`.
4. On verification fail: 402 + reason.

**No facilitator dependency.** Classic x402-solana brokers settlement through a third-party facilitator service that broadcasts the agent's signed SPL transfer. Obscura skips that — by the time the agent presents the envelope, the queue tx is already on chain (the agent's backend awaited Arcium MPC). The merchant verifies the prior settlement; nothing remains to broadcast.

---

## Repo structure

```
obscura/
├── apps/
│   ├── web/                          ← main Next.js 16 app (the Obscura backend + UI)
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── x402/sign/route.ts        ← agent-pay HOT PATH
│   │   │   │   ├── agents/                   ← agent CRUD
│   │   │   │   ├── merchants/                ← merchant CRUD
│   │   │   │   ├── topup/                    ← Dodo checkout flow
│   │   │   │   ├── webhooks/dodo/route.ts    ← fiat-in webhook
│   │   │   │   └── cron/
│   │   │   │       ├── claim-daemon/route.ts ← Umbra mixer claim daemon
│   │   │   │       └── reconcile/route.ts    ← stuck-tx repair
│   │   │   ├── (user)/                       ← agent-developer UI
│   │   │   ├── (merchant)/                   ← merchant UI
│   │   │   └── demo/                         ← live judge-facing demo
│   │   ├── lib/
│   │   │   ├── umbra.ts                      ← all @umbra-privacy/sdk calls
│   │   │   ├── solana.ts                     ← Helius RPC + treasury helpers
│   │   │   ├── db.ts + drizzle schema        ← Postgres
│   │   │   └── ...
│   │   └── components/                       ← React UI
│   ├── demo-merchant-news/           ← reference merchant (Express + merchant-sdk)
│   └── demo-agent/                   ← reference agent (Node + agent-sdk)
├── packages/
│   ├── sdk/                          ← @obscura-app/sdk (agent SDK)
│   ├── merchant-sdk/                 ← @obscura-app/merchant-sdk (Express middleware)
│   ├── db/                           ← @obscura-app/db (Drizzle schema + queries)
│   └── solana/                       ← @obscura-app/solana (web3.js helpers)
├── scripts/
│   └── wrap-treasury-sol.ts          ← devnet helper (wrap SOL → WSOL for the test asset)
├── UMBRA-DEPS.md                     ← peer-dependency pinning notes for @umbra-privacy/*
└── README.md                         ← this file
```

---

## Running locally

### Prerequisites

- Node 22+ (`nvm use` reads `.nvmrc`)
- pnpm 10+
- A Neon Postgres database (or any Postgres reachable via `DATABASE_URL`)
- A Helius API key (devnet RPC)
- An Umbra Indexer + Relayer URL (devnet endpoints — request from Umbra Discord)
- A funded Solana devnet keypair (the "treasury")

### Setup

```bash
# 1. Install
pnpm install

# 2. Configure
cp .env.example .env
# Fill in DATABASE_URL, HELIUS_RPC_URL, TREASURY_SECRET_KEY, UMBRA_*,
# AUTH_SECRET, AUTH_GOOGLE_ID/SECRET, etc.

# 3. Push schema to your DB
pnpm db:push

# 4. Wrap some treasury SOL into WSOL (Umbra devnet test asset)
pnpm umbra:wrap-treasury-sol 1

# 5. Run web + demo merchant in parallel
pnpm dev:demo
# → web on :3000, demo-merchant-news on :3001

# 6. In a second terminal, run the demo agent
cd apps/demo-agent && pnpm start
# → loops until Ctrl-C, ~25s/cycle, 2-4 paid x402 calls per cycle on devnet
```

### Why WSOL as the demo asset

Umbra's devnet doesn't currently support arbitrary SPL mints, only WSOL. On mainnet flip the env var `STABLECOIN_MINT` flips back to USDC and `STABLECOIN_DECIMALS` from 9 to 6. The pricing math in `lib/rates.ts` is decimal-naive (assumes 6 decimals) — on mainnet this is correct; on devnet WSOL there's a known cosmetic mismatch ("$5.55 USDC" in UI = `0.00555 WSOL` on chain, both numbers are accurate, just labeled differently). Documented; not a bug.

---

## Deployment

Production target: **Railway** (chosen for SSE compatibility + native cron support; see `apps/web/lib/event-broker.ts` for the in-process pub/sub that needs a single-instance Node runtime).

Four services:

1. **`web`** — the Next.js app, autodeployed from GitHub. Public domain → `obscurapp.com`.
2. **`demo-merchant-news`** — the reference merchant Express server. Public domain.
3. **`cron-claim-daemon`** — `curlimages/curl` Docker image, schedule `*/2 * * * *`, hits `/api/cron/claim-daemon` with `Authorization: Bearer $CRON_SECRET`.
4. **`cron-reconcile`** — same shape, schedule `*/5 * * * *`, hits `/api/cron/reconcile`.

All 4 services are configured in the same Railway project so they can address each other via Railway's internal DNS (`*.railway.internal`).

---

## Security model

### What we trust

- **The Obscura backend** — we have the master seed, we sign every payment, we write the audit log. This is the operator's own backend, not a third party.
- **Solana validators** — we trust the chain to deliver the queue + callback transactions.
- **Arcium MPC** — Umbra's MPC layer validates encrypted state transitions. This is foundational to the mixer's correctness.
- **`UMBRA_AGENT_SEED_SECRET`** — single critical secret. Lose it and every encrypted balance becomes unrecoverable. Rotate via the `umbra/v1` → `umbra/v2` domain-separator path with a migration job (planned, not built).

### What we do NOT trust

- **The Umbra indexer** — used for scanning UTXOs, but we verify Merkle proofs against on-chain state before claiming. A malicious indexer can't credit a UTXO to us that doesn't exist.
- **The Umbra relayer** — pays gas on the merchant's behalf. Worst case: relayer refuses to submit our claims, claims pile up unclaimed (we re-claim after the relayer recovers). Cannot steal funds.
- **Helius RPC** — we read state from it, but the merchant SDK independently re-verifies the queue tx via its own RPC connection. RPC failover doesn't compromise correctness.
- **The agent** — has only an API key, can only spend from its own assigned encrypted balance, can never exceed its monthly cap (atomic Postgres UPDATE).
- **The merchant** — can only verify that a payment landed for *its own* ETA address. Cannot impersonate other merchants.

### Treasury controls (mainnet plan, not on devnet)

For mainnet launch the single-keypair treasury splits into:

- **Cold treasury** — Squads 3-of-5 multi-sig, holds most USDC.
- **Hot operator** — single key, ~1 day of liquidity, signs per-top-up deposits.

See `project_treasury_architecture.md` for the full plan. Devnet uses a single keypair; test funds, test risk.

---

## Hackathon submission

- **Track:** Umbra Privacy track, Colosseum Solana Frontier Hackathon 2026.
- **Team:** Solo (jils.patel@scaler.com).
- **Live demo:** `https://obscurapp.com` *(deployed on Railway)*.
- **Demo video:** *(linked in the submission form)*.
- **License:** MIT (`LICENSE`).

### Why this fits the privacy track

Obscura is a vertical application of Umbra to a real, growing rail (x402). Where Umbra ships the cryptographic primitives (encrypted balances + mixer + MPC), Obscura wraps them in two SDKs that turn one HTTP standard (`402 Payment Required`) into a privacy-preserving payment layer for autonomous AI agents. Every Umbra primitive — direct deposits, encrypted balance reads, mixer transfers, receiver claims, withdrawals — is exercised in the agent + merchant flow.

The ETA→ETA mixer path (Path B) is the privacy-critical contribution: x402 by default leaks the agent's spending graph; replacing the public SPL transfer with an Umbra mixer commitment hides it.

---

*Built with Umbra. Deployed on Solana. Designed for agents.*
