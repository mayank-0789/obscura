# Umbra in Obscura — end-to-end reference

Everything you need to know to maintain Obscura's Umbra integration: what we use, where we call it from, what it costs, how it can fail, and how to upgrade it. Companion to the high-level pitch in `README.md`; this is the maintainer-grade doc.

---

## 1. What Umbra is (in one paragraph)

[Umbra Privacy](https://umbraprivacy.com) is a Solana-native confidential-payments protocol with three building blocks:

- **Encrypted Token Accounts (ETAs)** — per-user accounts holding a balance that's homomorphically encrypted. The owner can decrypt locally with their X25519 key; nobody else can.
- **Arcium MPC** — validates encrypted state transitions (deposits, transfers, claims) without seeing plaintext. Each transition emits a callback transaction confirming validity.
- **A receiver-claimable UTXO mixer** — leaves are commitments addressed to recipients; recipients scan the tree, decrypt commitments addressed to them, and claim them into their encrypted balance via Groth16 ZK proof + a relayer that pays gas.

Combined, these give you: pay encrypted amounts to encrypted addresses, with no public link between sender and receiver — all on Solana, all auditable in the sense that the *commitments* are on chain even though the *plaintext* isn't.

---

## 2. What Obscura uses from Umbra

Every Umbra SDK function we call, with file:line of its single call site. All Umbra integration is funneled through `apps/web/lib/umbra.ts` — there are no other call sites to `@umbra-privacy/sdk` or `@umbra-privacy/web-zk-prover` in the codebase.

| # | SDK function | Obscura wrapper | Where called from |
|---|---|---|---|
| 1 | `getUmbraClient` | `buildSubjectUmbraClient` (`umbra.ts:137`) and `buildTreasuryUmbraClient` (`umbra.ts:173`) | every Umbra op |
| 2 | `createSignerFromPrivateKeyBytes` | inside the two builders above | every Umbra op |
| 3 | `getUserRegistrationFunction` | `registerSubjectOnUmbra` (`umbra.ts:208`) | agent + merchant provisioning |
| 4 | `getPublicBalanceToEncryptedBalanceDirectDepositorFunction` | `depositTreasuryToEncryptedAccount` (`umbra.ts:293`) | Dodo top-up webhook (`webhooks/dodo/route.ts`) |
| 5 | `getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction` | `createReceiverClaimableUtxo` (`umbra.ts:452`) | x402 sign route (`x402/sign/route.ts:250`) |
| 6 | `getClaimableUtxoScannerFunction` | `scanReceiverClaimableUtxos` (`umbra.ts:504`) and inline at `cron/claim-daemon/route.ts` | merchant claim daemon (cron) |
| 7 | `getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction` | `claimReceiverClaimableUtxos` (`umbra.ts:550`) and inline at `cron/claim-daemon/route.ts` | merchant claim daemon (cron) |
| 8 | `getUmbraRelayer` | inside `claimReceiverClaimableUtxos` and the cron route | merchant claim daemon |
| 9 | `getEncryptedBalanceQuerierFunction` | `getEncryptedBalance` (`umbra.ts:366`) | x402 sign pre-flight + dashboard balance |
| 10 | `getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction` | `withdrawFromEncryptedAccount` (`umbra.ts:325`) | merchant cash-out (planned UI) |

ZK provers from `@umbra-privacy/web-zk-prover`:

| # | Prover | Used by |
|---|---|---|
| A | `getUserRegistrationProver` | registration step (`anonymous: true`) |
| B | `getCreateReceiverClaimableUtxoFromEncryptedBalanceProver` | sender-side mixer create |
| C | `getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver` | receiver-side mixer claim |

---

## 3. Identity model and key derivation

Every agent, merchant, and the treasury has its own Umbra keypair. We do **not** store keypairs in the database — they're derived deterministically from a single env-stored master secret.

### The derivation

```
master_seed = env.UMBRA_AGENT_SEED_SECRET   (32+ bytes, env-only)

seed(subject, id) = HMAC-SHA256(
   key   = master_seed,
   data  = "umbra/v1/" + subject + "-signing-key|" + id
)

keypair(subject, id) = Ed25519.fromSeed(seed(subject, id))
ETA address(subject, id) = keypair.publicKey.toBase58()
```

`subject` is `"agent"` or `"merchant"`. `id` is the corresponding row's UUID.

### Properties

| Property | How |
|---|---|
| **Non-invertible** | An attacker with the DB cannot reconstruct keypairs without `UMBRA_AGENT_SEED_SECRET` — HMAC's keyed structure protects against rainbow attacks. |
| **Domain-separated** | An `agents.id` and a `merchants.id` (both UUIDs) cannot collide on a single keypair, even under deliberate ID-engineering. The `umbra/v1/agent-signing-key\|` prefix guarantees disjoint inputs. |
| **Versioned** | The `v1` prefix is a future-proof rotation point. Bumping to `v2` rotates *every* key (would require a migration job; not built). |
| **Deterministic** | Re-deriving the same `(subject, id)` produces the same keypair forever. Lets us treat `eta_address` columns as a cache, not source of truth. |
| **No DB key column** | Compromise of just the database is insufficient to spend funds. Both DB AND `UMBRA_AGENT_SEED_SECRET` must leak. |

### Critical operational rule

**`UMBRA_AGENT_SEED_SECRET` is the single most important value in production.** Lose it and every encrypted balance becomes unrecoverable. Treat it like the root signing key of a custodian:

- Stored only in deployment env (Railway, .env files locally), never in DB, never in logs.
- Rotated only via the `v1` → `v2` migration path (and would require a coordinated drain + re-deposit per subject).
- Backed up offline before any large-fund deployment.

---

## 4. Subject lifecycle

The full life of an agent's or merchant's Umbra identity, in order:

```
   ┌──────────────────────────────────────────────────────────────────┐
   │                                                                  │
   │  1. DERIVE      etaAddress = keypair(subject, id).publicKey      │
   │                 (pure HMAC, no I/O — safe inside DB batches)     │
   │                                                                  │
   │  2. FUND        treasury → etaAddress, ~0.05 SOL                 │
   │                 (lets the subject pay its own register fees)     │
   │                                                                  │
   │  3. REGISTER    register({confidential: true, anonymous: true})  │
   │                 ─ creates X25519 key for direct deposits         │
   │                 ─ creates user commitment for mixer ops          │
   │                 ~3 transactions, ~10–60s                         │
   │                                                                  │
   │  4. OPERATE     deposit / spend / receive / withdraw             │
   │                 (any combination, any number of times)           │
   │                                                                  │
   │  5. (idle)      account stays on-chain forever; rent-free        │
   │                                                                  │
   └──────────────────────────────────────────────────────────────────┘
```

Steps 1–3 happen in `createAgentWallet` (in `apps/web/app/api/agents/route.ts`) and `createMerchantWallet` (in `apps/web/lib/merchants.ts:75`). They are run in sequence inside the provisioning flow and are idempotent (re-running on an already-registered subject is a no-op for completed steps).

---

## 5. Per-primitive deep dive

### 5.1 `getUmbraClient` — the SDK entry point

The Umbra SDK is constructed per-subject. Each call to a higher-level helper (`getUserRegistrationFunction`, `getPublicBalance...`, etc.) takes a client.

```ts
// apps/web/lib/umbra.ts:137
export async function buildSubjectUmbraClient(subject, subjectId) {
  const signer = await createSignerFromPrivateKeyBytes(
    deriveKeypair(subject, subjectId).secretKey,
  );
  return getUmbraClient({
    signer,
    network: env.UMBRA_NETWORK,                  // "solana-devnet" | "solana"
    rpcUrl: env.HELIUS_RPC_URL,                  // https
    rpcSubscriptionsUrl: resolveRpcSubscriptionsUrl(),  // wss
    indexerApiEndpoint: env.UMBRA_INDEXER_URL,
  });
}
```

**Caching:** subject clients are NOT cached (we have many subjects, each is cheap to rebuild). The treasury client IS cached (`getTreasuryUmbraClient`, `umbra.ts:163`) because it's process-wide and rebuilding it costs an extra signMessage round-trip.

**`rpcSubscriptionsUrl` derivation:** the SDK's transaction-confirmation path uses WebSocket subscriptions, which need a `wss://` endpoint. Most Solana providers (Helius, QuickNode, Triton) mirror their HTTP endpoint at `wss://` on the same path. We derive by default but allow `UMBRA_RPC_SUBSCRIPTIONS_URL` to override.

**`UMBRA_NETWORK`:** required to be one of `"solana-devnet"` or `"solana"`. Don't pass freeform strings — the SDK uses this internally to pick on-chain program IDs.

### 5.2 `getUserRegistrationFunction` — registration

```ts
// apps/web/lib/umbra.ts:208
export async function registerSubjectOnUmbra(subject, subjectId) {
  const client = await buildSubjectUmbraClient(subject, subjectId);
  const register = getUserRegistrationFunction(
    { client },
    { zkProver: getUserRegistrationProver() },
  );
  const signatures = await register({ confidential: true, anonymous: true });
  return signatures.map(String);
}
```

**Two modes, both required for Obscura's flows:**

- **`confidential: true`** sets the X25519 key for direct deposits and balance decryption. Without this, the subject cannot receive `getPublicBalanceToEncryptedBalance...Deposit` calls.
- **`anonymous: true`** registers the user commitment. Required on **both** the sender AND the receiver before any ETA → ETA mixer transfer. Without it, `createReceiverClaimableUtxo` throws Umbra error `18003` (`ENCRYPTED_USER_ACCOUNT_IS_ACTIVE_FOR_ANONYMOUS_USAGE_BIT_MUST_BE_SET`).

**Why we set both eagerly:** any merchant might receive an x402 mixer transfer; any agent might pay one. Registering with the union of capabilities at provisioning is cheaper than retrofitting later.

**Idempotency:** the SDK reads on-chain status bits per step. Calling `register` on a subject that's already `confidential` and `anonymous` runs zero transactions and returns an empty signatures array. Calling it on a subject that's `confidential` but not `anonymous` runs only the anonymous step. This means a one-shot bootstrap script for retrofitting old subjects is safe.

**Latency:** ~10–60s. Cold-cache Groth16 prove dominates. The prover is CPU-bound; on a low-spec server it can hit 30s+ on the first call, dropping to ~5–10s once the proving key is in memory.

### 5.3 `getPublicBalanceToEncryptedBalanceDirectDepositorFunction` — direct deposits

```ts
// apps/web/lib/umbra.ts:293
const deposit = getPublicBalanceToEncryptedBalanceDirectDepositorFunction({
  client: treasuryClient,
});
const result = await deposit(
  address(input.etaAddress),                         // recipient (already encrypted account)
  address(getStablecoinMint().toBase58()),           // mint (USDC or WSOL)
  input.amountMicros as U64,                         // amount in mint's atomic units
);
```

**What's hidden vs visible:**
- **Visible on chain:** sender (treasury), recipient ETA pubkey, mint, gross amount.
- **Hidden:** the resulting encrypted balance value (the recipient's running total stays encrypted).

**Why we tolerate the visible deposit:** the funds came from fiat-to-crypto rails (Dodo) anyway, which cannot be made private. The privacy budget is spent on the *spending pattern* (mixer transfers), not the deposit step.

**The `DepositResult`:** carries `queueSignature`, `callbackSignature` (when finalized), and `callbackStatus`. `"finalized"` is the only success state; any other state means the deposit may still complete async — verify on-chain before retrying.

### 5.4 Mixer create — `getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction`

The hot path. Runs every time an agent pays a merchant via x402.

```ts
// apps/web/lib/umbra.ts:452
const zkProver = getCreateReceiverClaimableUtxoFromEncryptedBalanceProver();
const createUtxo = getEncryptedBalanceToReceiverClaimableUtxoCreatorFunction(
  { client: senderClient },
  { zkProver },
);
const result = await createUtxo({
  amount: input.amountMicros as U64,
  destinationAddress: address(input.recipientEtaAddress),  // merchant ETA
  mint: address(getStablecoinMint().toBase58()),
});
// result: { createProofAccountSignature, queueSignature, callbackSignature?, callbackStatus? }
```

**What it does, mechanically:**
1. Decrypts the sender's encrypted balance locally with the sender's X25519 key.
2. Generates a Groth16 proof: sender has ≥ amount, the new commitment is well-formed, the nullifier is fresh.
3. Submits a "create-proof-account" transaction (stages the proof on chain).
4. Submits the queue transaction: encrypted balance debit + UTXO insertion into the mixer tree.
5. Awaits the Arcium MPC callback: the MPC verifies the encrypted state transition, emits a callback transaction, sets `callbackStatus = "finalized"` on success.

**What's hidden vs visible:**
- **Visible on chain:** sender ETA, queue tx, callback tx — but the *recipient's ETA address is NOT visible* (the destination is encoded in the encrypted UTXO commitment leaf).
- **Hidden:** amount, recipient.

**Why this is Path B:** Umbra exposes two ETA → ETA paths. Path A (direct codama-level instruction) is a 24-account transaction with no high-level helper; transfers at protocol level but leaves a public sender→recipient link in the queue tx accounts list. Path B (mixer) routes through the receiver-claimable UTXO tree, breaking the sender→recipient link via the commitment tree. We pick B for strictly stronger privacy.

**Latency:** ~10–25s on devnet warm. Breakdown: ~5s prove (warm) + 2–3 transaction round-trips + Arcium MPC callback. Cold prove can hit 30s+ on the first call after process restart.

**Critical post-call rule** (`apps/web/app/api/x402/sign/route.ts:281`):

```ts
if (!finalized) {
  // The queue tx already landed. The encrypted balance debit IS already
  // in flight on chain. We CANNOT revert the cap counter without
  // diverging from on-chain truth. Leave cap incremented, mark tx
  // pending, refuse to issue payment header. Reconciler resolves later.
  return apiError("signing_failed", "...");
}
```

This is the load-bearing safety property: *if Arcium hasn't confirmed, we treat the agent's spend as committed for cap-purposes*. Otherwise an agent could exploit "callback didn't finalize" as a free-spend bug.

### 5.5 Mixer scan — `getClaimableUtxoScannerFunction`

```ts
// inline at apps/web/app/api/cron/claim-daemon/route.ts and umbra.ts:504
const scan = getClaimableUtxoScannerFunction({ client: merchantClient });
const result = await scan(
  BigInt(treeIndex) as ...,            // start tree
  BigInt(insertionIndex) as ...,       // start position within tree
);
// result: { received: ScannedUtxoData[], selfBurnable: [...], nextScanStartIndex }
```

The scanner walks the on-chain mixer commitment tree from a `(treeIndex, insertionIndex)` cursor. For each leaf, it attempts to decrypt with the subject's key. Successfully-decrypting leaves are ones addressed to this subject and returned in `received`.

**Branded-type gotcha:** the SDK types `treeIndex` and `insertionIndex` as `U32` — a `bigint` brand. Passing a `number` throws `Cannot mix BigInt and other types` at runtime. Always cast: `BigInt(0) as never`.

**Cursor persistence:** the SDK does not auto-persist scan position. The caller must pass `(treeIndex, startInsertionIndex)` and persist `nextScanStartIndex` between runs. In the serverless cron route we currently scan from `(0, 0)` every run because there's no persistent local FS — see deferred hardening item 0 below.

**Filtered categories:** `received` is the only slice we use. `selfBurnable` (UTXOs the subject can burn back to itself) and public variants are ignored.

### 5.6 Mixer claim — `getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction`

```ts
// apps/web/lib/umbra.ts:550
const relayer = getUmbraRelayer({ apiEndpoint: env.UMBRA_RELAYER_URL });
const zkProver = getClaimReceiverClaimableUtxoIntoEncryptedBalanceProver();
const claim = getReceiverClaimableUtxoToEncryptedBalanceClaimerFunction(
  { client: merchantClient },
  {
    fetchBatchMerkleProof: client.fetchBatchMerkleProof,  // from indexer
    zkProver,
    relayer: {
      submitClaim: relayer.submitClaim,
      pollClaimStatus: relayer.pollClaimStatus,
      getRelayerAddress: relayer.getRelayerAddress,
    },
  },
);
const result = await claim(scanResult.received);
// result: { batches: Map<batchId, { status: "completed"|"failed", ... }> }
```

**What it does:**
1. Fetches Merkle proofs from the indexer for each UTXO leaf (one round-trip per batch).
2. Generates a Groth16 claim proof: I own this leaf, the leaf is in the on-chain tree, the nullifier is fresh.
3. Submits the claim batch to the relayer.
4. The **relayer pays gas, signs, and broadcasts** the on-chain claim transaction. The merchant's wallet never appears as fee payer.
5. Waits for relayer status to flip to `completed` (or `failed`).

**Why the relayer matters for privacy:** without it, the merchant's actual wallet would have to pay gas on the claim, putting it on chain at every claim event. The relayer abstraction means the merchant's wallet stays untouched; only the encrypted balance accumulates.

**Indexer trust:** the indexer is **untrusted**. It can lie about which leaves exist, but the SDK verifies Merkle proofs against on-chain state before submitting the claim. A malicious indexer can't make us claim a leaf that doesn't exist.

**Per-claim fee model (devnet measured 2026-04-26):**
- 1,000,000-micro transfer → recipient credited 995,733 micros.
- Protocol fee ≈ 4,267 micros ≈ **0.43%** of the gross.
- Formula (from SDK): `baseFee + floor((amount - baseFee) * bps / 10_000)`.
- Mainnet figures will differ; re-measure before quoting.

**Spent-nullifier behavior:** the relayer batches claims. **The whole batch fails if any single nullifier in it is already spent.** If the scanner returns 5 leaves but 1 is already claimed (e.g. another reconciler finished it), submitting all 5 as a batch reverts all 5, wasting prove cycles for the other 4. Mitigation: maintain a `claimedLeafIds` set, filter scan results before submitting. The CLI version of the daemon does this; the serverless cron version doesn't (no persistent FS) and relies on the relayer-side rejection.

**Latency:** ~30s per claim in steady state. Groth16 prove (~25s) + indexer round-trip + relayer sign + on-chain confirm.

### 5.7 Encrypted balance read — `getEncryptedBalanceQuerierFunction`

```ts
// apps/web/lib/umbra.ts:366
const query = getEncryptedBalanceQuerierFunction({ client });
const result = await query([address(getStablecoinMint().toBase58())]);
const entry = result.get(mintAddr);
if (entry?.state === "shared") return BigInt(entry.balance);
return null;
```

**Local decrypt, no MPC.** Subjects in `state === "shared"` mode have an X25519 key pair the SDK can use to locally decrypt the balance without an Arcium round-trip. Fast (<100ms), no on-chain interaction.

**Other states:**
- `mxe` — balance is in MPC-managed state, would need an MPC round-trip. Not used in our flow (we register everyone as confidential = shared).
- `uninitialized` — per-mint balance account exists but never funded.
- `non_existent` — per-mint balance account doesn't exist on chain yet (subject registered but never received any deposit for this mint).

For dashboard purposes we collapse all three into "treat as zero" — the subject has no usable funds.

### 5.8 Withdrawals — `getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction`

```ts
// apps/web/lib/umbra.ts:325
const withdraw = getEncryptedBalanceToPublicBalanceDirectWithdrawerFunction({
  client: subjectClient,
});
const result = await withdraw(
  address(input.destinationAddress),    // public ATA receiving the funds
  address(getStablecoinMint().toBase58()),
  input.amountMicros as U64,
);
```

Like deposits, this is a direct (non-mixer) operation. The withdraw event is on chain; only the prior encrypted balance state stays hidden. Fine for end-of-day cash-out: the per-call payment graph is already protected; the withdraw is a single privacy-leak point at the end.

Currently used only by the operator's emergency-drain flow (private endpoint, not user-facing). The merchant cash-out UI (planned) will route here.

---

## 6. Cost and latency model

### 6.1 Per-operation latency on Solana devnet (warm cache)

| Operation | Wall-clock | Where it dominates |
|---|---|---|
| `register({confidential, anonymous})` | 10–60s | Groth16 prove (~30s cold) + 3 txs |
| `depositTreasury...` | 10–20s | Queue tx + Arcium callback |
| `createReceiverClaimableUtxo` | 10–25s | Prove (~5s warm) + 2 txs + callback |
| `scanReceiverClaimableUtxos` | 1–3s | One indexer round-trip + decrypt |
| `claimReceiverClaimableUtxos` | 30–60s | Prove (~25s) + indexer + relayer + tx |
| `getEncryptedBalance` | <100ms | Local decrypt, no MPC |
| `withdrawFromEncrypted...` | 10–20s | Same shape as deposit, reversed |

### 6.2 Mainnet expectations

Mainnet RPC quality and Arcium throughput will improve numbers, but the prove-time floor is CPU-bound and roughly the same. Budget for: same prove costs, halved tx-confirmation cost.

### 6.3 Per-transfer fee (mixer claim)

Devnet measured 2026-04-26: ~0.43% of gross transfer amount, deducted at claim time. The merchant receives `gross - protocol_fee`. Subtract this when computing what merchant earns vs what agent paid in dashboards.

---

## 7. Operational notes

### 7.1 Idempotency and retries

| Operation | Idempotent? | Mechanism |
|---|---|---|
| `register` | ✅ | SDK reads on-chain status bits per step |
| `deposit` | ❌ | Each call mints a new commitment. Caller must dedupe (we use `webhook_log` UNIQUE on Dodo event ID). |
| `createReceiverClaimableUtxo` | ❌ | Each call adds a new UTXO. Caller must dedupe (we use in-flight fingerprint set in `x402/sign/route.ts`). |
| `scan` | ✅ | Read-only. |
| `claim` | ✅ | Nullifier check — re-claiming a spent leaf reverts on chain. |
| `withdraw` | ❌ | Same shape as deposit; caller must dedupe. |

### 7.2 Failure modes worth knowing

| Symptom | Cause | Recovery |
|---|---|---|
| `ENCRYPTED_USER_ACCOUNT_IS_ACTIVE_FOR_ANONYMOUS_USAGE_BIT_MUST_BE_SET` (error 18003) | Sender or receiver registered with `anonymous: false` | Re-call `register({anonymous: true})` — idempotent re-run runs only the missing step. |
| `Cannot mix BigInt and other types` | Passed `number` to scan/claim where SDK expects `U32` (bigint brand) | Cast: `BigInt(n) as never` |
| Queue tx lands but `callbackStatus !== "finalized"` | Arcium MPC didn't finalize within the SDK's monitor window | Reconciler (`/api/cron/reconcile`) inspects queue tx via Helius RPC, marks confirmed/failed within 5 min |
| Whole claim batch reverts | One spent nullifier in the batch | Filter `claimedLeafIds` before submitting (CLI daemon does this; serverless cron doesn't yet) |
| `web-zk-prover` peerDep warning | Mismatched SDK version (see section 9 below) | `peerDependencyRules` override silences it |

### 7.3 Replay protection (merchant SDK)

The merchant SDK keeps a 5-minute cache (`seenQueueSigs` map in `packages/merchant-sdk/src/express.ts`) of queue signatures it has accepted. A second presentation of the same envelope is rejected. This prevents an agent from caching a successful payment header and reusing it across multiple paid calls.

### 7.4 Plaintext logging

`apps/web/lib/umbra.ts` currently logs `amountMicros`, ETA addresses, and tx signatures in plaintext at info level. **Devnet OK; mainnet not OK** — a log scraper correlating with the indexer can reverse the privacy story we're selling. Pre-mainnet hardening: redact amounts to log buckets ("1k–10k" / "10k–100k") or omit. Tracked in section 8.

---

## 8. Deferred hardening (pre-mainnet checklist)

Items the Day 6 audit (2026-04-26) flagged that we knowingly deferred. None block hackathon submission; address before any mainnet rollout. Order of priority:

1. **Reconciliation job for non-finalized MPC callbacks** — ✅ DONE (`/api/cron/reconcile`).
2. **Idempotency key against client retries** — ✅ DONE (in-process `inFlightFingerprints` set in `x402/sign/route.ts`). Multi-instance deployments need Redis with the same key shape.
3. **Per-agent concurrency cap** — ✅ DONE (`PER_AGENT_INFLIGHT_LIMIT = 3` in `x402/sign/route.ts`). Same Redis caveat for multi-instance.
4. **Plaintext amount logging** — ❌ TODO. Redact to log buckets before mainnet.
5. **`web-zk-prover@2.0.1` vs `sdk@4.0.0` peerDep mismatch** — ✅ DOCUMENTED (section 9 below). Re-validate before any Umbra package bump.
6. **Daemon overlap lock-file** — ❌ TODO. Cron at 1-min cadence with claims taking ~30s+ → overlapping invocations claiming the same UTXOs. Safe (nullifier check reverts second claim) but wasteful. Add PID-style lockfile in the CLI daemon.
7. **Daemon claimedLeafIds tracking on serverless** — ⚠ PARTIAL. CLI form persists; serverless `/api/cron/claim-daemon` doesn't (no persistent local FS). Production fix: Redis-backed `claimedLeafIds` keyed by `merchant:<id>`. Defer until traffic justifies it.

---

## 9. Dependency pinning

The Umbra SDK + ZK prover packages are **pinned to exact versions** in `apps/web/package.json` (no `^` or `~` ranges) because of a metadata mismatch managed explicitly here:

| Package | Version | Notes |
|---|---|---|
| `@umbra-privacy/sdk` | `4.0.0` | Latest. Provides the mixer + claim factories. |
| `@umbra-privacy/web-zk-prover` | `2.0.1` | Latest. Declares peerDep on `@umbra-privacy/sdk@2.0.3`. |
| `@umbra-privacy/umbra-codama` | `2.0.2` | Codama-generated low-level instructions. |

### The peerDep mismatch

`web-zk-prover@2.0.1` is the only version published as of writing, and it declares `peerDependencies: { "@umbra-privacy/sdk": "2.0.3" }`. We ship `sdk@4.0.0`. pnpm would warn loudly without help, so the root `package.json` includes:

```json
"pnpm": {
  "peerDependencyRules": {
    "allowedVersions": {
      "@umbra-privacy/web-zk-prover>@umbra-privacy/sdk": "4.0.0"
    }
  }
}
```

This silences the warning. **The runtime is verified compatible** — the prover only consumes the `IZkProverFor*` interface shapes from `@umbra-privacy/sdk/interfaces`, which are stable across 2.x → 4.x. The live e2e flow (agent → `/api/x402/sign` → mixer create → claim daemon) exercises both register-side and claim-side proofs and has been validated against devnet.

### Upgrade rules

- **Do NOT bump `^` ranges silently** — every Umbra package version is exact for a reason. A minor SDK bump could change the IZkProver interface and break the prover at runtime, not at compile time.
- **Before bumping `@umbra-privacy/sdk`**:
  1. Check `web-zk-prover`'s peerDep on the new SDK version.
  2. Run a live demo cycle (`pnpm dev:demo` + demo-agent) and confirm queue + callback signatures land for at least one paid call.
  3. Update the `peerDependencyRules` `allowedVersions` to match.
- **When `web-zk-prover@4.x` ships** (eventual): pin to that, drop the `peerDependencyRules` override.

---

## 10. Quick reference

**Single rule to remember:** every Umbra interaction routes through `apps/web/lib/umbra.ts`. If you find an `import "@umbra-privacy/sdk"` anywhere else, that's drift — fold it back in.

**Single secret to protect:** `UMBRA_AGENT_SEED_SECRET`.

**Single env var to flip for mainnet:** `UMBRA_NETWORK = "solana"` (plus the cluster swap on `HELIUS_RPC_URL`, `STABLECOIN_MINT`, `STABLECOIN_DECIMALS`, indexer/relayer URLs).

**Single command to verify the rail still works:** `pnpm dev:demo` + `cd apps/demo-agent && pnpm start` → expect 3 paid calls in ~80s on devnet.
