# How Payrail Works

A walkthrough for someone who's never touched the codebase, using two characters to make it concrete.

---

## TL;DR

Payrail is a **payment rail for AI agents**. It lets agents pay APIs on a per-call basis — pennies per request, no subscriptions — using Indian UPI on one end and Solana stablecoins under the hood. Neither the agent developer nor the API provider needs to touch a crypto wallet or know what a blockhash is.

The protocol under the hood is **x402**: an open standard that extends HTTP with a payment flow, built on top of Solana and facilitated by a neutral third party (PayAI).

---

## Meet the characters

Two real people trying to solve real problems.

**Priya** — AI engineer in Bangalore. She's building a news-summarization agent that posts to her company's Slack every morning. Her agent needs to call paid news APIs to fetch articles. She doesn't know Solana; she's never bought crypto.

**Amit** — indie dev in Mumbai. He runs a paid news API at `api.amitnews.com`. He wants to charge per API call. He's heard of stablecoins but has no interest in running a Solana node.

Payrail is what connects Priya's agent to Amit's API — billed per call, settled in USDC on Solana, with neither side ever touching a wallet.

---

## The problem before Payrail

### Priya's world

Every paid API she wants to use today forces one of two bad choices:

1. **Monthly subscriptions.** She buys Amit's $49/month plan. Her agent makes 200 calls this month (wastes $40) or 5,000 calls (gets rate-limited). Worse: if her agent wants to use four different APIs, that's four separate subscriptions, four credit cards, four dashboards. Agents don't fit subscription pricing — their usage is bursty and autonomous.

2. **"Crypto-native" per-call billing.** Modern APIs (Amit's included) can accept stablecoin micropayments via x402. But now Priya must: buy USDC from an Indian crypto exchange, transfer to Solana, set up a wallet, manage seed phrases, top it up with SOL for gas fees, install `x402-solana` (200 lines of wallet glue), and monitor her agent for runaway spend. She's shipping an agent, not a crypto trading app.

### Amit's world

He wants to charge 0.01 USD per API call. His options:

- **Stripe or Razorpay:** fees are 2.9% + ₹2 per transaction. For a ₹0.80 API call, **the fee is 3-4× the actual price**. Destroys unit economics on micropayments.
- **Accept crypto directly:** he's now responsible for wallet management, chain reorgs, KYC-compliant exchange accounts to cash out. He wanted to build a news API, not a crypto exchange.

Neither ships the product.

---

## What is x402? (The protocol that makes this possible)

Before explaining what Payrail does, understand the protocol we build on.

### The 402 status code has been waiting 30 years

HTTP has had a **`402 Payment Required`** status code since 1991, defined in the original RFC alongside `200 OK` and `404 Not Found`. But for three decades, no one agreed on a standard way to use it. It sat unused, reserved "for future use."

In 2025, **Coinbase proposed x402** — a concrete protocol spec for what a client and server should actually exchange when a resource needs payment. The spec is open, not proprietary. Anyone can implement it.

### How x402 actually works (the HTTP dance)

x402 is a two-request handshake.

#### Request 1: the polite ask

The client sends a normal HTTP request:

```http
GET /article/42 HTTP/1.1
Host: api.amitnews.com
```

No payment attached. The client doesn't assume anything costs money.

#### Response 1: the server's price list

If the resource requires payment, the server responds with:

```http
HTTP/1.1 402 Payment Required
PAYMENT-REQUIRED: eyJhY2NlcHRzIjpbeyJzY2hlbWUiOiJleGFjdCIs...

{"error":"payment required","accepts":[...]}
```

The `PAYMENT-REQUIRED` header is a base64-encoded JSON object like this:

```json
{
  "x402Version": 2,
  "accepts": [{
    "scheme": "exact",
    "network": "solana-devnet",
    "asset": "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
    "payTo": "EzEfpe5CXUo4qL6RW9NwQ9pGrAJTjKXZkabcYY2xjgTw",
    "amount": "10000",
    "maxTimeoutSeconds": 60,
    "extra": { "feePayer": "<PayAI-facilitator-pubkey>" }
  }]
}
```

Read that object as: *"If you want this resource, transfer exactly 10,000 base units (= 0.01 USDC, 6 decimals) of this mint, to this recipient, on this chain. The gas fee will be paid by this facilitator wallet — not by you. Sign and send within 60 seconds."*

The `"accepts"` array can list multiple payment options (different chains, different tokens). The client picks one.

#### Request 2: the retry with proof of payment

The client signs a Solana transaction matching those requirements, then retries the same request with a new header:

```http
GET /article/42 HTTP/1.1
Host: api.amitnews.com
PAYMENT-SIGNATURE: eyJ0cmFuc2FjdGlvbiI6IjRoOXhLcDJh... 
```

The `PAYMENT-SIGNATURE` header is the base64-encoded signed Solana transaction. Important: the transaction is **signed but not yet broadcast**. The server will broadcast it during settlement.

#### Response 2: settled and served

The server:

1. Extracts and validates the signed transaction (does it match the requirements from round 1?).
2. Submits it to a **facilitator** (more on facilitators in a moment), which co-signs as fee-payer and broadcasts to the blockchain.
3. Waits for on-chain confirmation.
4. Serves the real response:

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Payment-Response: eyJ0cmFuc2FjdGlvbiI6IjRoOXhLcDJh...

{"article": "Solana breaks 10k TPS again", "body": "..."}
```

The `X-Payment-Response` header lets the client verify the transaction signature on-chain if it wants to audit the payment.

### The x402 facilitator — who pays for gas?

Here's a subtle design choice x402 makes: **the client doesn't pay the Solana network fee.** A third-party "facilitator" does.

Why? Because if the client had to pay gas, it would need SOL in its wallet. Agents would need to manage two tokens (USDC for payments + SOL for gas), which defeats the whole "the agent doesn't know Solana exists" pitch.

The facilitator (in our case, **PayAI** at `facilitator.payai.network`) is a hosted service that:

1. When asked by a merchant, returns its own wallet pubkey as the `extra.feePayer`.
2. When asked by a merchant with a signed transaction, co-signs it as fee-payer, broadcasts to Solana, and eats the SOL gas out of its own wallet.
3. Offers this free for up to 10K settlements/month as a land-grab to become the default x402 facilitator (they'll monetize later via premium features).

Facilitators are interchangeable — the protocol works with any of them. Coinbase has their own. You can self-host one. The client and server don't care as long as both speak x402.

---

## What Payrail adds on top of x402

x402 solves the *protocol* problem: how does an HTTP server charge per request and how does a client pay. But x402 by itself still requires the client to hold SOL, manage a wallet, and build the signed transaction.

**Payrail wraps x402 with three things the agent developer actually wants:**

1. **Fiat on-ramp.** Priya tops up with UPI. Dodo Payments collects the rupees; Payrail converts to USDC and funds her agent's wallet.
2. **Custody + signing as a service.** Priya's agent never holds a private key. Payrail holds the keys via Privy (with server-side delegated signing) and signs x402 transactions on the agent's behalf when asked via API key.
3. **Guardrails.** Monthly spend caps, per-agent isolation, revocable API keys, real-time spend dashboards.

**And on the merchant side, the same Payrail backend adds:**

1. **Managed payout wallet.** Amit doesn't provision a Solana wallet. Payrail mints one for him and registers it with the chain-watcher (Helius).
2. **Realtime earnings dashboard.** Every on-chain payment to Amit's wallet flows into his dashboard within ~2 seconds via Helius → SSE.
3. **Fiat off-ramp** (v2): Amit withdraws accumulated USDC to INR via Dodo Payouts.

The `@payrail/sdk` (for agents) is a 3-line-integration drop-in replacement for `x402-solana/client`. The `@payrail/merchant-sdk` (for merchants) is a 1-line-middleware drop-in replacement for `x402-solana/server`. Under the hood, both still use the x402 protocol — Payrail just hides the wallet-management gymnastics.

---

## Architecture (the big picture)

```
                          ┌──────────────────────────┐
                          │   payrail.sh (backend)   │
                          │                          │
  ┌─────────────────┐     │  ┌────────────────────┐  │
  │ Priya's agent   │     │  │ /api/x402/sign     │  │
  │ code            │────▶│  │ — cap check        │  │
  │ @payrail/sdk    │◀────│  │ — build Solana tx  │  │     ┌─────────────┐
  └────────┬────────┘     │  │ — delegate to Privy│◀─┼────▶│  Privy      │
           │              │  └────────────────────┘  │     │  wallet API │
           │ HTTP         │                          │     └─────────────┘
           │              │  ┌────────────────────┐  │
           ▼              │  │ /api/webhooks/dodo │  │     ┌─────────────┐
  ┌─────────────────┐     │  │ /api/topup/...     │◀─┼────▶│  Dodo       │
  │ Amit's API      │     │  └────────────────────┘  │     │  Payments   │
  │ server          │     │                          │     └─────────────┘
  │ @payrail/       │     │  ┌────────────────────┐  │
  │   merchant-sdk  │     │  │ /api/webhooks/     │  │     ┌─────────────┐
  └────────┬────────┘     │  │   helius           │◀─┼─────│  Helius     │
           │              │  └────────────────────┘  │     │  webhooks   │
           │ POST settle  │                          │     └──────▲──────┘
           ▼              │  ┌────────────────────┐  │            │
  ┌─────────────────┐     │  │ SSE broker         │  │            │
  │ PayAI           │     │  │ → merchant         │  │            │
  │ facilitator     │     │  │   dashboard        │  │            │
  │ (verify/settle, │     │  └────────────────────┘  │            │
  │  pays gas)      │     └──────────────────────────┘            │
  └────────┬────────┘                                              │
           │ broadcast signed tx                                   │
           ▼                                                       │
  ┌──────────────────────────────────────────────────────────┐    │
  │                   Solana blockchain                       │────┘
  │  (USDC moves from agent's wallet to merchant's wallet)    │
  └──────────────────────────────────────────────────────────┘
```

Arrows are HTTP calls (mostly JSON over REST, plus SSE for realtime push to the dashboard). Every external dependency is single-purpose and replaceable:
- **Privy** → custody & signing. Swappable for Turnkey if needed.
- **PayAI** → x402 facilitator. Swappable for Coinbase CDP or self-hosted.
- **Helius** → Solana RPC + webhook. Swappable for any Solana indexer.
- **Dodo** → fiat on-ramp/off-ramp. Swappable for Razorpay (different geography) or direct Circle APIs (different tier).
- **Solana** → settlement. Swappable for any stablecoin chain (protocol-level abstraction planned for Tempo / UCP).

---

## Code map — where to look in the repo

This is a Turborepo monorepo. Three things matter most to a developer reading the code:

### The two SDKs (what developers integrate)

| Package | Purpose | Read this first |
|---|---|---|
| [`@payrail/sdk`](./packages/sdk/) | Client SDK agent devs install. Wraps `fetch()`, handles 402 → sign → retry. | [`packages/sdk/src/index.ts`](./packages/sdk/src/index.ts) |
| [`@payrail/merchant-sdk`](./packages/merchant-sdk/) | Express-style middleware API providers install. Returns 402, verifies + settles via facilitator. | [`packages/merchant-sdk/src/express.ts`](./packages/merchant-sdk/src/express.ts) |
| [`@payrail/solana`](./packages/solana/) | Shared Solana helpers (treasury keypair, SPL transfer, ATA init) used by the backend. | [`packages/solana/src/transfer.ts`](./packages/solana/src/transfer.ts) |
| [`@payrail/db`](./packages/db/) | Drizzle schema for every table. | [`packages/db/src/schema.ts`](./packages/db/src/schema.ts) |

### Backend routes (the Payrail product itself)

| Route | What it does | File |
|---|---|---|
| `POST /api/x402/sign` | **Heart of the product.** Receives the merchant's 402, enforces spend cap, builds + signs the Solana tx via Privy. | [`apps/web/app/api/x402/sign/route.ts`](./apps/web/app/api/x402/sign/route.ts) |
| `POST /api/auth/sync` | Creates/updates the `users` row on Privy login. | [`apps/web/app/api/auth/sync/route.ts`](./apps/web/app/api/auth/sync/route.ts) |
| `POST /api/onboarding/role` | Sets user's role (agent dev / merchant / both), provisions merchant wallet + ATA if needed. | [`apps/web/app/api/onboarding/role/route.ts`](./apps/web/app/api/onboarding/role/route.ts) |
| `POST /api/agents` | Mints an agent wallet (via Privy, with delegated signer attached), inserts agent + budget + first API key. | [`apps/web/app/api/agents/route.ts`](./apps/web/app/api/agents/route.ts) |
| `POST /api/topup/session` | Creates a Dodo checkout session for ₹ top-up. | [`apps/web/app/api/topup/session/route.ts`](./apps/web/app/api/topup/session/route.ts) |
| `POST /api/webhooks/dodo` | Dodo → Payrail: on `payment.succeeded`, treasury transfers USDC to the agent's wallet. | [`apps/web/app/api/webhooks/dodo/route.ts`](./apps/web/app/api/webhooks/dodo/route.ts) |
| `POST /api/webhooks/helius` | Helius → Payrail: on confirmed USDC transfer to a merchant, flip `transactions.status='confirmed'` + push SSE. | [`apps/web/app/api/webhooks/helius/route.ts`](./apps/web/app/api/webhooks/helius/route.ts) |
| `GET /api/merchants/me/events` | SSE endpoint the merchant dashboard subscribes to for realtime payment notifications. | [`apps/web/app/api/merchants/me/events/route.ts`](./apps/web/app/api/merchants/me/events/route.ts) |

### Key internal libraries (the glue)

| File | Purpose |
|---|---|
| [`apps/web/lib/x402-tx.ts`](./apps/web/lib/x402-tx.ts) | Builds the unsigned Solana `VersionedTransaction` that satisfies an x402 payment requirement. |
| [`apps/web/lib/agent-auth.ts`](./apps/web/lib/agent-auth.ts) | Validates `pk_…` bearer tokens (hashed lookup in `agent_api_keys`). |
| [`apps/web/lib/merchants.ts`](./apps/web/lib/merchants.ts) | `provisionMerchant` — wallet mint + ATA init + Helius register. |
| [`apps/web/lib/privy-server.ts`](./apps/web/lib/privy-server.ts) | Privy server SDK singleton + auth key setup. |
| [`apps/web/lib/solana.ts`](./apps/web/lib/solana.ts) | Lazy singletons: `getConnection()`, `getTreasury()`, `getStablecoinMint()`. |
| [`apps/web/lib/event-broker.ts`](./apps/web/lib/event-broker.ts) | In-process pub/sub for SSE (merchant dashboard realtime). |
| [`apps/web/lib/helius.ts`](./apps/web/lib/helius.ts) | Registers merchant payout wallets with Helius's Enhanced Webhook. |

### Runnable demo apps (great for reading end-to-end)

| App | What it shows | Entry point |
|---|---|---|
| [`apps/demo-merchant-news`](./apps/demo-merchant-news/) | A merchant server using `@payrail/merchant-sdk` with 3 paid endpoints. | [`src/index.ts`](./apps/demo-merchant-news/src/index.ts) |
| [`apps/demo-agent`](./apps/demo-agent/) | An agent using `@payrail/sdk` in a loop to hit the demo merchant. | [`src/index.ts`](./apps/demo-agent/src/index.ts) |

**If you're a dev and you only read 4 files, read these:**
1. [`apps/demo-agent/src/index.ts`](./apps/demo-agent/src/index.ts) — what an agent dev writes (3 lines)
2. [`apps/demo-merchant-news/src/index.ts`](./apps/demo-merchant-news/src/index.ts) — what a merchant dev writes (1 line)
3. [`packages/sdk/src/index.ts`](./packages/sdk/src/index.ts) — what happens inside `agent.fetch()` on 402
4. [`apps/web/app/api/x402/sign/route.ts`](./apps/web/app/api/x402/sign/route.ts) — the core signing + cap + policy engine

---

## Sign-up: how Priya and Amit onboard

### Priya (agent developer)

1. Visits `payrail.sh`, clicks sign in, picks Google. **Privy** creates a Solana wallet scoped to her user. She never sees the wallet's private key; Privy holds it.
2. On the onboarding page, picks **"Agent developer"**. Her user row gets `role='user'`.
3. Lands on `/dashboard`. Clicks **"+ New agent"**, names it `news-summarizer`, sets a monthly cap of ₹500. Payrail mints a **separate** Solana wallet for this agent via Privy (with Payrail configured as the delegated signer via `additionalSigners: [{ signerId: <auth-key-id> }]`). The wallet's pubkey is stored in `agents.public_key`.
4. Payrail generates a one-time API key: `pk_f1b2lk5tkbrljkyzww51q1jl0no9`. Its SHA-256 hash is stored in `agent_api_keys.key_hash`. The plaintext is shown **exactly once** on screen. Priya copies it into her `.env`.
5. Clicks **"Top up"**, picks ₹500. Hits Dodo's UPI flow, pays with her BHIM app.
6. Dodo fires a `payment.succeeded` webhook to Payrail's backend. Payrail:
   - Verifies the webhook signature.
   - Looks up the agent the payment is for (from metadata).
   - Converts ₹500 → USDC at the locked rate (~$5.88 USDC).
   - Signs an SPL token transfer with the **treasury keypair** (a separate Payrail-controlled wallet pre-funded with USDC) moving 5.88 USDC to `news-summarizer`'s wallet on Solana devnet.
   - On confirmation, inserts a `transactions` row with `kind='topup'`, `status='confirmed'`, stamps the on-chain signature.
7. Priya refreshes her dashboard. Balance shows "$5.88 USDC". No wallet, no seed phrase, no exchange account.

### Amit (API provider)

1. Same Google sign-in at `payrail.sh`. Privy wallet created for his user account.
2. On onboarding, picks **"API provider"**. His user row gets `role='merchant'`. Payrail simultaneously:
   - Mints a **payout wallet** for him via Privy (also with delegated-signer configuration — important for v2 cash-out flow).
   - Inserts a `merchants` row with his payout pubkey.
   - **Initializes the payout wallet's USDC ATA** (associated token account) — treasury pays the ~0.002 SOL rent. Without this, agents couldn't pay him on the first call (SPL transfers require the destination ATA to exist).
   - Registers his payout pubkey with Helius's webhook, so every future on-chain transfer into his wallet pushes a notification to Payrail.
3. Amit lands on `/merchants/dashboard`. Sees his payout wallet, a zero balance, no payments yet.
4. He copies the payout wallet pubkey. In his Express server:
   ```ts
   import { payrail } from "@payrail/merchant-sdk";
   const pay = payrail({
     payoutWallet: process.env.PAYOUT_WALLET,
     network: "solana-devnet",
   });
   app.get("/article/:id", pay.charge({ amount: "10000" }), handler);
   ```
5. He deploys. One line added. The middleware speaks x402.

---

## The runtime flow (slow-mo, with all the plumbing)

Priya's agent calls `agent.fetch("https://api.amitnews.com/article/42")`. Watch what happens, in order.

### Phase 1 — The polite request

```ts
const agent = new Payrail({ apiKey: process.env.PAYRAIL_KEY });
const res = await agent.fetch("https://api.amitnews.com/article/42");
```

`@payrail/sdk` fires a plain `fetch(url)`. No special headers. The SDK is a thin layer above `fetch` — agent code doesn't know Solana exists.

**Code**: [`packages/sdk/src/index.ts`](./packages/sdk/src/index.ts) — the `Payrail.fetch()` method. It's a thin wrapper over global `fetch` that checks the response status, and only reacts if it's 402.

### Phase 2 — Amit's middleware returns 402

The middleware:

1. Checks for a `PAYMENT-SIGNATURE` header. Missing → this is round 1.
2. Calls `handler.createPaymentRequirements(routeConfig, resourceUrl)`. This one-time-per-request hop asks the PayAI facilitator's `/supported` endpoint: "what feePayer pubkey should I tell the client to use?"
3. Returns a 402 response with the `PAYMENT-REQUIRED` header built from those requirements (merchant pubkey, amount, chain, fee payer, asset mint).

The HTTP response looks exactly like the x402 spec example above.

**Code**: [`packages/merchant-sdk/src/express.ts`](./packages/merchant-sdk/src/express.ts) — the returned middleware function. The two branches (no payment header → 402, has payment header → verify+settle) are the whole file.

### Phase 3 — SDK sees 402, asks Payrail to sign

The SDK notices `res.status === 402`, extracts the `PAYMENT-REQUIRED` header, and POSTs to Payrail's backend:

```
POST https://payrail.sh/api/x402/sign
Authorization: Bearer pk_f1b2lk5tkbrljkyzww51q1jl0no9
Content-Type: application/json

{
  "paymentRequiredHeader": "<base64 from merchant>",
  "resourceUrl": "https://api.amitnews.com/article/42"
}
```

This is the **only** time the agent's API key is used. The SDK doesn't sign — signing is Payrail's job.

**Code**: [`packages/sdk/src/index.ts`](./packages/sdk/src/index.ts) — the `handle402` flow. The SDK attaches the Bearer token, relays the raw `PAYMENT-REQUIRED` header (doesn't parse/interpret it — the backend does), and awaits the signed response.

### Phase 4 — Payrail backend: auth, cap, build, sign

**Code**: [`apps/web/app/api/x402/sign/route.ts`](./apps/web/app/api/x402/sign/route.ts). This is the single most important route in the codebase — read it top-to-bottom if you want to understand Payrail.

Six things happen in under a second:

#### 4a. Authenticate the API key

`agentAuthGuard(req)` hashes the bearer token with SHA-256, looks up `agent_api_keys.key_hash`, joins in the `agents` and `budgets` rows. Returns `{ agent, budget }` or 401.

Code: [`apps/web/lib/agent-auth.ts`](./apps/web/lib/agent-auth.ts).

#### 4b. Validate the merchant's 402

`validateRequirements(requirements)` ensures:
- `asset` matches our configured stablecoin mint (rejects attempts to pay in random tokens).
- `payTo` is a valid Solana pubkey.
- `extra.feePayer` is present and valid.
- `amount` parses as a positive bigint.

Guards against malformed or malicious 402 responses.

#### 4c. Atomic spend cap check

A single SQL statement enforces the budget:

```sql
UPDATE budgets
SET spent_usdg = spent_usdg + 10000
WHERE agent_id = <news-summarizer-id>
  AND spent_usdg + 10000 <= cap_usdg
RETURNING id
```

Zero rows returned = over cap → the route returns `402 over_cap` to the SDK, which throws. No TOCTOU race under concurrent signs — the check and increment happen inside one database operation.

#### 4d. Insert a pending transaction row

```sql
INSERT INTO transactions (agent_id, kind, direction, amount_usdg,
                         counterparty, merchant_host, status)
VALUES ('<agent-id>', 'spend', 'out', 10000,
        'EzEfpe5CX…', 'api.amitnews.com', 'pending')
RETURNING id
```

**Before** signing. If the sign fails downstream, the pending row gets marked `failed` and the cap increment is reverted — spent_usdg stays consistent with reality even under partial failures.

#### 4e. Build the Solana transaction

[`apps/web/lib/x402-tx.ts`](./apps/web/lib/x402-tx.ts) — `buildUnsignedX402PaymentTx` constructs a `VersionedTransaction`:

- **Instruction 0:** `ComputeBudgetProgram.setComputeUnitLimit(400_000)` — required by the facilitator to be in position 0.
- **Instruction 1:** `ComputeBudgetProgram.setComputeUnitPrice(100_000)` — required in position 1.
- **Instruction 2:** `createTransferCheckedInstruction(sourceAta, mint, destAta, ownerPubkey, 10000, 6)` — moves 0.01 USDC from Priya's agent ATA to Amit's payout ATA.

Critical: `message.feePayer = extra.feePayer` (PayAI's pubkey from the 402). NOT the agent. **This is why agents don't need SOL.**

Also critical: the function pre-checks that BOTH ATAs exist via `connection.getAccountInfo`. If the destination (merchant) ATA is missing, it throws `"merchant must initialise their payout wallet"`. This is why merchant onboarding opens the ATA at signup time — see [`packages/solana/src/ensure-ata.ts`](./packages/solana/src/ensure-ata.ts) and where it's called in [`apps/web/lib/merchants.ts`](./apps/web/lib/merchants.ts).

#### 4f. Sign via Privy delegated signing

```ts
await privy.walletApi.solana.signTransaction(agent.privyWalletId, versionedTx)
```

Privy sees that `news-summarizer`'s wallet was created with `additionalSigners: [{ signerId: env.PRIVY_AUTHORIZATION_KEY_ID }]`. Our backend holds the private key for that `signerId`. Privy verifies the request is signed by the delegated signer, then applies the agent wallet's signature to the transaction.

**At no point does Priya's code see a private key. At no point does Payrail's backend see the agent's private key either.** Privy is the custody boundary.

#### 4g. Return signed tx

```ts
const paymentSignatureHeader = createPaymentPayload(
  signedTx, requirements, resourceUrl
);
return apiOk({ paymentSignatureHeader });
```

The signed VersionedTransaction serialized to bytes, base64-encoded, wrapped with metadata.

### Phase 5 — SDK retries; Amit settles via PayAI

The SDK makes the second HTTP request:

```
GET https://api.amitnews.com/article/42
PAYMENT-SIGNATURE: <base64 signed tx>
```

Amit's middleware ([`packages/merchant-sdk/src/express.ts`](./packages/merchant-sdk/src/express.ts)):

1. **Extracts** the payment header.
2. **Verifies** via `POST https://facilitator.payai.network/verify` — PayAI checks the transaction bytes against the requirements (correct amount, correct recipient, valid agent signature, not expired).
3. **Settles** via `POST https://facilitator.payai.network/settle` — PayAI:
   - Adds its own fee-payer signature (it holds the keypair matching `extra.feePayer`).
   - Broadcasts to Solana via its RPC.
   - Waits for `confirmed` commitment (typically 1-2 seconds on devnet).
   - Returns `{ success: true, transaction: "<solana-signature>", network: "solana-devnet" }`.

**PayAI just paid the SOL gas out of its own wallet** — about 0.000005 SOL per tx (~$0.001).

4. Middleware sets `X-Payment-Response: <base64 settlement>` header, calls `next()`, Amit's `/article/:id` handler runs and returns 200 with the JSON body.

The SDK receives the final 200, returns the JSON to Priya's code. End-to-end latency: ~1.5 seconds.

### Phase 6 — Async: dashboards update via Helius

While Priya's agent was receiving its 200, the Solana transaction was confirming on-chain. Helius (which we registered with Amit's payout wallet) sees the transfer and POSTs to Payrail's webhook:

```
POST https://payrail.sh/api/webhooks/helius
Authorization: <HELIUS_WEBHOOK_AUTH_TOKEN>

[{
  "signature": "4h9xKp2aBc…",
  "tokenTransfers": [{
    "mint": "4zMMC9sr…",
    "fromUserAccount": "<Priya's agent pubkey>",
    "toUserAccount": "EzEfpe5CX…",
    "rawTokenAmount": { "tokenAmount": "10000", "decimals": 6 }
  }]
}]
```

The handler ([`apps/web/app/api/webhooks/helius/route.ts`](./apps/web/app/api/webhooks/helius/route.ts)):

1. **Verifies the auth header** via constant-time SHA-256 compare.
2. **Filters to stablecoin mint only** — ignores SOL transfers and other tokens.
3. **Re-verifies on-chain** — `connection.getSignatureStatuses([sig])` directly checks Solana. Defends against a leaked auth token being used to forge payloads.
4. **Idempotency guard** — `INSERT INTO webhook_log (provider='helius', event_id=<sig>) ON CONFLICT DO NOTHING`. Duplicate delivery = no-op.
5. **Matches the pending row** — finds the `transactions` row from Phase 4d by joining `agents.public_key = fromUserAccount` AND `counterparty = toUserAccount` AND `amount_usdg = amount` AND `created_at > now() - 60 min`.
6. **Flips to confirmed** — `UPDATE transactions SET status='confirmed', solana_sig=<sig>, confirmed_at=now()`.
7. **Publishes to the in-process event broker** — `eventBroker.publish(merchantPaymentTopic(payoutWallet), { ... })`.
8. **SSE pushes to browser** — Amit's open dashboard tab has an SSE connection to `/api/merchants/me/events`. The SSE message triggers TanStack Query to invalidate the recent-payments query, which refetches and renders the new row.

Amit sees "+ 0.01 USDC from 9vMr… · 2 seconds ago · [Solscan link]" without refreshing the page.

Priya's agent dashboard, polling every 10s, shows "Budget left ₹499.15 / ₹500" on next refresh.

---

## Role breakdown — who does what

| Actor | Responsibility |
|---|---|
| **Priya's agent code** | Calls `agent.fetch()`. That's it. |
| **`@payrail/sdk`** | Catches 402, relays the header to Payrail backend, retries with the signed payment header. Never holds a key. |
| **Payrail backend** | Authenticates API keys, enforces spend caps atomically, builds the Solana transaction, delegates signing to Privy, returns the signed tx. |
| **Privy** | Custody layer. Holds the agent wallet's private key. Signs transactions on Payrail's authorization (delegated signer config). |
| **Amit's server** | Hosts the paid endpoints. Just Express + `@payrail/merchant-sdk` middleware. |
| **`@payrail/merchant-sdk`** | Returns 402 on missing payment. On retry, extracts the signature, forwards to PayAI for verify + settle, lets the request through on success. |
| **PayAI facilitator** | Verifies transactions match requirements, co-signs as fee-payer, broadcasts to Solana, confirms landing. Eats SOL gas. |
| **Solana** | Settlement layer. USDC actually moves from one account to another, in ~1-2 seconds, for ~$0.001 in fees. |
| **Helius** | Watches the blockchain for transfers touching merchant payout wallets. Pushes webhook events to Payrail so dashboards stay live. |
| **Dodo Payments** | Collects ₹ via UPI/card when Priya tops up. Sends webhook to Payrail on success. |
| **Payrail treasury** | A Payrail-controlled Solana keypair pre-funded with USDC. On top-up, moves USDC to the agent's wallet. On merchant provisioning, pays the ~0.002 SOL ATA rent. |

---

## How Amit eventually takes his money home

Amit's payout wallet accumulates USDC over time — 0.01 here, 0.005 there, from dozens or thousands of agents. When he wants to cash out:

**v1 flow (manual):** Amit withdraws USDC on his own via Jupiter + Indian crypto exchange. Payrail doesn't participate.

**v2 flow (planned):** Dashboard button **"Withdraw to bank"**. Payrail:

1. Signs an SPL transfer from his payout wallet to Payrail's cash-out wallet (using the same Privy delegated-signer configuration).
2. Sells the USDC for INR via Dodo Payouts or a direct OTC desk.
3. Deposits to Amit's bank account, minus a platform spread (2-3%, still 10× cheaper than Stripe for micropayments).

Treasury handles the USDC→INR conversion; Amit sees rupees in his bank within hours.

---

## Complete reference — every detail and edge case

This is the "nothing is hand-waved" section. If you're a developer debugging an edge case, implementing a new feature, or auditing for security, this is where you look.

### Wallets — who holds which, and who pays SOL for what

Payrail runs **four categories of Solana wallet**. Each has a different custody story and a different fee-funding story.

| Wallet | Custody | Private key held by | SOL fees paid by | When created |
|---|---|---|---|---|
| **User wallet** | Privy | Privy | N/A (never transacts directly) | On first Google sign-in |
| **Agent wallet** | Privy + delegated signer | Privy | PayAI (via x402 facilitator) | On `POST /api/agents` |
| **Merchant payout wallet** | Privy + delegated signer | Privy | PayAI (for inbound), treasury (for cash-out v2) | On `POST /api/onboarding/role` with role='merchant' |
| **Treasury** | Raw keypair (env var) | Our server | Itself (from pre-funded SOL) | Set up once, out-of-band |

**Why the treasury is NOT on Privy:** lower latency + no dependency. If Privy has an outage, Dodo webhooks keep crediting agents. See `lib/solana.ts:getTreasury()` — it's a singleton loaded from `TREASURY_SECRET_KEY` at module load.

**Why agent/merchant wallets use `additionalSigners` not `authorizationKeyIds`:** Privy's `createWallet` accepts both parameters, but only `additionalSigners: [{ signerId: <auth-key-id> }]` actually binds the delegated signer at sign-time. `authorizationKeyIds` looks like it should work (Privy's docs even imply it does), but is silently ignored by `signTransaction`. Validated via [`scripts/spike-privy-variants.ts`](./scripts/spike-privy-variants.ts) — re-run that spike if Privy's API ever changes.

### Associated Token Accounts (ATAs) — the invisible layer

A Solana wallet can't directly hold an SPL token. It needs an **Associated Token Account** — a separate on-chain account, owned by the wallet, that holds balances for one specific token mint. ATAs cost ~0.002 SOL in rent (refundable if the account is ever closed).

**The rule: the destination ATA must exist before a transfer can land.** If Alice tries to transfer 1 USDC to Bob's wallet and Bob has no USDC ATA, the transfer errors out on-chain.

#### Agent ATA lifecycle
- Created on the **first top-up**. Treasury calls `transferSpl` with `createAssociatedTokenAccountIdempotentInstruction` as the first instruction, which opens the agent's USDC ATA. Treasury pays the ~0.002 SOL rent.
- Subsequent top-ups: ATA already exists; the idempotent instruction is a no-op.

#### Merchant ATA lifecycle
- **Created at merchant provisioning.** See [`apps/web/lib/merchants.ts`](./apps/web/lib/merchants.ts) — after the merchants row insert, we call `ensureAta` ([`packages/solana/src/ensure-ata.ts`](./packages/solana/src/ensure-ata.ts)) with treasury as payer. **ZERO USDC is transferred** — the function emits only `createAssociatedTokenAccountIdempotentInstruction`. Treasury pays ~0.002 SOL for the account rent.
- Why not let the first paying agent open the ATA? Because that would make Priya's agent pay rent for a stranger's token account — a DoS vector and bad economics.
- Why not let the merchant open their own ATA? They have no SOL at signup time. Chicken-and-egg.
- **If `ensureAta` fails** (RPC error, treasury out of SOL): the merchant row still gets inserted, but a warning is logged. The merchant can manually initialize by having anyone transfer them a tiny amount of USDC. Best-effort philosophy matches the Helius register pattern.

#### Idempotency
`createAssociatedTokenAccountIdempotentInstruction` is the "safe under concurrency" variant — if the ATA already exists, the instruction no-ops instead of failing. Our code double-protects with a `getAccountInfo` pre-check so we skip the whole tx if the ATA is already there.

### API keys — two kinds, both revealed once

| Kind | Prefix | Format | Who uses it | Where stored |
|---|---|---|---|---|
| **Agent API key** | `pk_` | 28-char nanoid | Agents authenticate to `/api/x402/sign` | `agent_api_keys.key_hash` (SHA-256, unsalted) |
| **Merchant API key** | `mk_` | 28-char nanoid | Merchants authenticate for admin operations (future) | `merchant_api_keys.key_hash` |

**Why SHA-256 unsalted?** High-entropy API keys (~168 bits) don't need salting — brute force is infeasible either way. Salting adds DB complexity and interferes with lookup-by-hash, which is how we authenticate in constant time. Documented at [`apps/web/lib/agent-keys.ts`](./apps/web/lib/agent-keys.ts).

**Reveal-once UX:** The plaintext key is shown on a green banner exactly once, immediately after creation. A `beforeunload` handler warns the user if they try to close the tab without copying. If they miss it, they must rotate the key (reveals a new one, invalidates the old via `revoked_at`).

**Route-change survival:** The reveal card uses `sessionStorage` because creating an agent from `/agents/[id]` triggers `router.push` which unmounts the AppShell. Without sessionStorage, the plaintext key would be destroyed on route change. See [`apps/web/components/dashboard/app-shell.tsx`](./apps/web/components/dashboard/app-shell.tsx).

### Budget caps — the spend engine

Every agent has a `budgets` row with `cap_usdg` (lifetime max for the period) and `spent_usdg` (running total). The period is hardcoded to `monthly` in v1.

**Enforcement is a single SQL statement** ([`/api/x402/sign/route.ts`](./apps/web/app/api/x402/sign/route.ts)):

```sql
UPDATE budgets
SET spent_usdg = spent_usdg + <amount>
WHERE agent_id = <id>
  AND spent_usdg + <amount> <= cap_usdg
RETURNING id
```

- If zero rows return → over cap → route returns `402 over_cap` to the SDK.
- No TOCTOU window under concurrent signs. Two parallel signs will serialize at the row lock.
- The increment is **optimistic** — we increment before the tx lands on-chain. If the tx fails later (facilitator error, blockhash expiry), the route reverts via `safeRevertCap`. If the server crashes between increment and revert, the spent counter is slightly ahead of reality until a v2 reconciler sweeps pending-that-never-landed transactions.

**Monthly period reset**: NOT automated in v1. A cron would flip `spent_usdg = 0` at the start of each calendar month. Left manual for now; short-lived demos run over hours, not months.

### Rate limits — Upstash-backed, gracefully optional

| Scope | Action | Limit | Window |
|---|---|---|---|
| per-user | Agent creation | 5 | 1 hour |
| per-user | Merchant creation | 1 | 10 seconds |
| per-user | Top-up session creation | 10 | 1 hour |

All implemented via `lib/ratelimit.ts` → `@upstash/ratelimit` + `@upstash/redis`. **If `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` env vars are unset, all limiters short-circuit to "allow"** so local dev works without needing Upstash credentials.

### Error code catalog — every response code the backend can return

Source of truth: [`apps/web/lib/api.ts`](./apps/web/lib/api.ts).

| Code | HTTP | Meaning | Client recovery |
|---|---|---|---|
| `missing_token` | 401 | Authorization header missing | Re-auth, force sign-in |
| `invalid_token` | 401 | Privy JWT failed verification | Force sign-out |
| `invalid_signature` | 401 | Webhook signature check failed | N/A (external) |
| `forbidden` | 403 | Authenticated but lacks privilege | Show "not allowed" message |
| `user_not_synced` | 404 | JWT valid but users row not yet inserted | Retry 3x with backoff; on final fail, re-sync |
| `not_found` | 404 | Resource doesn't exist or isn't yours | Show not-found state |
| `bad_request` | 400 | Malformed request body / validation | Fix inputs and retry |
| `rate_limited` | 429 | Over rate limit | Wait + retry |
| `agent_limit_reached` | 400 | User has 50 agents (hard cap) | Delete old agents or contact support |
| `agent_inactive` | 403 | Agent is paused or cancelled | Re-activate agent |
| `invalid_challenge` | 400 | Merchant's 402 payload malformed | Abort, don't retry |
| `over_cap` | 402 | Payment would exceed spend cap | Top up more or raise cap |
| `signing_failed` | 500 | Privy sign call errored | Check logs; may be delegated-signer config |
| `server_error` | 500 | Unknown backend failure | Retry with backoff |

### Transactions table — the ledger of everything

Every on-chain movement creates a row in `transactions` (see [`packages/db/src/schema.ts`](./packages/db/src/schema.ts)).

| Column | Purpose |
|---|---|
| `id` | UUID, PK |
| `agent_id` | Which agent is the party (nullable for future user-scoped flows) |
| `kind` | `topup` \| `spend` \| `cashout` (v2) |
| `direction` | `in` \| `out` (relative to the agent) |
| `amount_usdg` | Atomic units (6-decimal micros) |
| `amount_inr` | Paise (for topups only) |
| `rate_snapshot` | `numeric(10,4)` — INR/USD rate at the time (for FX audit) |
| `counterparty` | Other party's Solana pubkey (merchant on spend, "TREASURY" on topup) |
| `merchant_host` | Hostname for audit (e.g. `api.amitnews.com`) |
| `status` | `pending` \| `confirmed` \| `failed` |
| `solana_sig` | The on-chain tx signature (nullable until confirmed) |
| `dodo_payment_id` | For topups, the Dodo `pay_…` id |
| `created_at` / `confirmed_at` | Timestamps |

**Lifecycle invariant:** every row starts `pending`. Most flip to `confirmed` (either via facilitator settle response or Helius webhook); some flip to `failed` (sign error, RPC timeout). No row stays `pending` forever in healthy operation — stuck rows are a signal of an incomplete webhook path that needs manual reconciliation.

### Dodo webhook — defensive payment crediting

[`apps/web/app/api/webhooks/dodo/route.ts`](./apps/web/app/api/webhooks/dodo/route.ts) handles `payment.succeeded` events with four layers of safety:

1. **Signature verification** — via `dodo.webhooks.unwrap()`, uses `DODO_WEBHOOK_KEY`. Fails → 401 (Dodo stops retrying forged events).
2. **Idempotency** — `INSERT INTO webhook_log (provider='dodo', event_id=<webhook-id>) ON CONFLICT DO NOTHING`. Duplicate delivery reads the existing row; if `processed_at` is set, returns 200 no-op.
3. **Pending-row-before-transfer** — inserts a `transactions` row with `status='pending'` BEFORE calling `transferSpl`. If the transfer lands but we crash before the confirmation update, the next retry finds the pending row.
4. **Self-healing on blockhash expiry** — `transferSpl` throws `TransferAlreadyLanded` (claim the signature) or `TransferNeverLanded` (safe to retry) depending on whether the orphaned tx actually landed on-chain. Never double-spends.

**Metadata contract:** every Dodo checkout session sends `metadata: { agent_id, user_id, amount_inr_paise }`. The webhook validates this with Zod — if Dodo changes their payload shape, we fail loudly instead of silently mis-crediting.

**Orphaned Privy wallets:** if the DB insert fails after `createMerchantWallet` or `createAgentWallet` succeeds, the Privy wallet exists with no matching DB row. `@privy-io/server-auth` has no delete API, so these wallets are permanent. Accepted risk for v1; a v2 background job would page Privy's REST API and mark unmatched wallets as archived.

### Helius webhook — the realtime bridge

[`apps/web/app/api/webhooks/helius/route.ts`](./apps/web/app/api/webhooks/helius/route.ts) handles Enhanced Webhook deliveries.

**Config:**
- Single webhook configured on Helius dashboard (`HELIUS_WEBHOOK_ID`), watching a dynamic `accountAddresses` list.
- Each new merchant appends their payout wallet via GET→modify→PUT in [`apps/web/lib/helius.ts`](./apps/web/lib/helius.ts). **Not atomic** — two concurrent signups within ~500ms can clobber each other's registrations (only last PUT wins). Bounded by the 1-per-10s merchant-create rate limit; a v2 post-signup reconciler (enumerate merchants, ensure each payout_wallet is in the list) is the proper fix.
- `authHeader` sent verbatim (no `Bearer ` prefix). Compared constant-time via SHA-256 digests to close length-probe side-channels.

**Per-event pipeline:**
1. Verify auth header.
2. Filter `tokenTransfers` by `env.STABLECOIN_MINT` (skips SOL, other tokens).
3. Validate signature format (`SOLANA_SIG_RE`) — rejects malformed input before any DB write.
4. Re-verify on-chain via `getSignatureStatuses(..., searchTransactionHistory: true)`. Must be `confirmed` or `finalized`. Defeats forged-payload attacks even with leaked auth token.
5. `INSERT INTO webhook_log (provider='helius', event_id=<sig>) ON CONFLICT DO NOTHING`. Duplicate delivery no-op.
6. `confirmPendingTx`: finds the `transactions` row matching `kind='spend' AND agent.public_key=fromUserAccount AND counterparty=toUserAccount AND amount_usdg=amount AND created_at > now()-60min`. Updates to `confirmed`.
7. Publishes to in-process `eventBroker` → SSE pushes to open dashboard tabs.

**Match ambiguity edge case:** same agent pays same merchant the same amount back-to-back within 60 min. The `desc(created_at) limit 1` picks the newest. If on-chain ordering flips from our pending-row-creation order (rare — facilitator reorders a batch), one row ends up with the wrong sig. Dashboard display unaffected (amounts are identical). Acceptable v1 limitation.

**Random USDC drops (not from an agent):** webhook fires, `confirmPendingTx` finds no matching pending row (no agent.public_key matches sender), logs `no pending tx matched`, returns. Dashboard stays unchanged. This is why the Circle faucet drop to init a merchant ATA doesn't pollute the feed.

### SSE event broker — in-process, single-node

[`apps/web/lib/event-broker.ts`](./apps/web/lib/event-broker.ts) is an in-memory pub/sub. Topics: `merchant-payment:<payoutWallet>`. Subscribers: open SSE connections from `/api/merchants/me/events`.

**Single-node constraint:** works only when one Next.js process serves both the webhook receiver AND the SSE subscriber. Distributed across multiple nodes, the webhook might land on node A while the dashboard is subscribed to node B → no push, dashboard stays stale. Fine for Railway single-container deployment. Scaling requires Redis Pub/Sub or similar.

**Reconnect behavior:** if the SSE connection drops, the browser's EventSource auto-reconnects. TanStack Query's normal polling continues in parallel, so at worst a dropped event causes a ~10s delay before the dashboard refreshes via poll.

### Database schema — 10 tables and why each exists

| Table | Why it exists |
|---|---|
| `users` | One row per Privy identity. Tracks role (`user`/`merchant`/`both`). |
| `agents` | Per-agent metadata — name, public key, Privy wallet id, status. |
| `budgets` | 1:1 with agents (unique index). Split out for future period flexibility. |
| `agent_api_keys` | Many-per-agent. Supports rotation via `revoked_at`. |
| `merchants` | Per-merchant metadata — payout wallet, Dodo cash-out account id. |
| `merchant_api_keys` | Many-per-merchant. Symmetric with agent keys. |
| `merchant_apis` | Passive catalog of a merchant's registered API endpoints. Metadata only. |
| `transactions` | The ledger. Every on-chain movement. |
| `webhook_log` | Dedup per-(provider, event_id). Idempotency glue. |
| `x402_nonces` | Replay-attack protection for the x402 protocol. |

Conventions: UUIDs (not serials), `timestamptz`, `bigint` for money base units, `numeric(10,4)` for FX rates, soft deletes via status enum + `revoked_at` (never hard deletes), `ON DELETE CASCADE` on child FKs.

### Route protection — the edge-level guard

[`apps/web/proxy.ts`](./apps/web/proxy.ts) (renamed from `middleware.ts` in Next.js 16) gates authenticated routes. It:

- Reads Privy session cookies (`privy-token`, `privy-id-token`).
- On `/dashboard`, `/agents/*`, `/topup`, `/merchants/dashboard/*` — if cookies missing, redirects to `/`.
- Does NOT verify the JWT signature at the edge. Verification happens downstream in `authGuard` (server components, API routes). Rationale: importing `@privy-io/server-auth` into the edge runtime would bloat the bundle; the downstream layers already enforce.

### Environment variables — complete list

Source of truth: [`apps/web/lib/env.ts`](./apps/web/lib/env.ts). Validated via `@t3-oss/env-nextjs` + Zod.

**Required (server):** `DATABASE_URL`, `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `PRIVY_AUTHORIZATION_KEY`, `PRIVY_AUTHORIZATION_KEY_ID`, `DODO_PAYMENTS_API_KEY`, `DODO_WEBHOOK_KEY`, `DODO_TOPUP_PRODUCT_ID`, `HELIUS_RPC_URL`, `TREASURY_SECRET_KEY`, `TREASURY_PUBLIC_KEY`, `STABLECOIN_MINT`, `STABLECOIN_DECIMALS`.

**Required (client):** `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_SOLANA_CLUSTER`.

**Optional:** `DODO_ENVIRONMENT` (defaults to test_mode), `HELIUS_API_KEY` + `HELIUS_WEBHOOK_ID` + `HELIUS_WEBHOOK_AUTH_TOKEN` (dashboards fall back to polling if missing), `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (rate limiters short-circuit to "allow" if missing).

### Mainnet flip — the 4-env-var change

To switch from devnet demo to mainnet production, change **only** these 4 env vars:

1. `NEXT_PUBLIC_SOLANA_CLUSTER=mainnet-beta`
2. `HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=...`
3. `STABLECOIN_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` (mainnet USDC)
4. `TREASURY_SECRET_KEY` → new mainnet-funded treasury keypair

Plus: create a new Helius webhook on mainnet, point `HELIUS_WEBHOOK_ID` at it. Switch `DODO_ENVIRONMENT=live_mode` when ready to accept real UPI.

Zero code changes. The CAIP-2 chain ID abstraction in [`apps/web/app/api/x402/sign/route.ts`](./apps/web/app/api/x402/sign/route.ts) automatically picks up the new cluster.

### Operational footguns (the runbook)

Real failures we've hit and how to spot them:

| Symptom | Root cause | Fix |
|---|---|---|
| `/api/webhooks/dodo` returns 500 with `failed to get recent blockhash: 401 Invalid API key` | `HELIUS_RPC_URL` has invalid `?api-key=` | Get fresh key from Helius dashboard, update env, restart |
| `/api/x402/sign` returns `signing_failed` | Agent was created before `additionalSigners` migration (un-signable) OR `PRIVY_AUTHORIZATION_KEY_ID` env missing | Create fresh agent OR set env var |
| `/api/x402/sign` returns 500 with `merchant ATA ... does not exist` | Merchant provisioned before `ensureAta` fix, no USDC ATA | Send any USDC to merchant wallet (Circle faucet / another wallet) to init ATA |
| Dodo webhook 500 with `insufficient funds` | Treasury out of devnet USDC | Top up via Circle faucet: https://faucet.circle.com → Solana/devnet → TREASURY_PUBLIC_KEY |
| Helius webhook never fires | Stale ngrok URL registered with Helius | Update `webhookURL` via Helius dashboard or PUT API |
| Dodo webhook returns 401 | `DODO_WEBHOOK_KEY` doesn't match Dodo's configured signing secret | Copy secret from Dodo dashboard → endpoint → signing secret, paste into env |
| 10+ copies of merchant row for same user | Missed unique index on `merchants.owner_user_id` | Applied via migration `0002_violet_senator_kelly.sql` |

### Settings a reviewer can change without breaking anything

- `CYCLE_MS` on demo-agent `.env` (how often agent loops)
- Prices in `demo-merchant-news/src/index.ts` (`pay.charge({ amount })`)
- Monthly caps on agent creation
- `NEXT_PUBLIC_APP_URL` when deploying to a new domain

### Settings that require careful change

- `PRIVY_AUTHORIZATION_KEY` / `PRIVY_AUTHORIZATION_KEY_ID` — rotating these makes existing agents un-signable until re-migrated
- `TREASURY_SECRET_KEY` — rotating requires moving funds from old treasury to new, updating env, restart
- `STABLECOIN_MINT` — requires all agents to re-open ATAs for the new mint

### What WON'T work, and why (known v1 limitations)

- **Concurrent merchant signups (same 500ms window)** can clobber each other's Helius `accountAddresses` registration. Worst case: one merchant's dashboard stays on polling mode. Fixable with a post-signup reconciler.
- **Distributed deployment** breaks the in-process SSE broker. Single Railway container is fine; multi-node needs Redis Pub/Sub.
- **Over-cap race** when two signs land simultaneously at exactly cap boundary — one wins the atomic update, the other returns `over_cap`. Correct behavior, but the losing call's merchant sees a 402 instead of a 200. Retry-able client-side.
- **Agent pause/cancel buttons are UI stubs** — the DB column exists (`status`), the enforcement path in `/api/x402/sign` checks it, but the "pause this agent" UI button isn't wired. Manual DB update works as a workaround.
- **Docs on /docs/users/* redirect to /docs/agents/*** via 301 — old memory of a URL rename.
- **Subscription payments (recurring)** are NOT supported — only per-call micropayments. By design; subscriptions are a bad fit for agent usage patterns.

---

## Why this architecture is defensible

### Double-spend safety

Every on-chain payment flows through a `transactions` row that moves `pending → confirmed`. The spend-cap increment + pending-row insert happen atomically before the Privy sign call. If Privy fails, cap reverts; row marks failed. If the transaction lands but the confirmation-update fails, the next Helius delivery re-matches the pending row and completes it via `TransferAlreadyLanded` detection. At no point can a budget get mis-accounted relative to on-chain reality.

### Webhook forgery resistance

The Helius webhook is gated by a shared auth token (constant-time compared) AND re-verifies every event against Solana directly via `getSignatureStatuses`. Even a leaked auth token can't flip a pending row to confirmed with a fake signature — the on-chain check would fail.

### No custody of private keys

Payrail holds NO user/agent/merchant private keys. Privy is the custody boundary. What Payrail holds is the **delegated signer** key — permission to ask Privy to sign, not the key itself. If Payrail's signer key is compromised, attackers can drain agent wallets only within spend caps (not arbitrary amounts), and only for as long as Privy's key-rotation takes.

### Per-agent isolation

Every agent has its own Solana wallet and its own spend cap. A compromised agent API key can drain that agent's budget but cannot touch the user's other agents or their primary wallet. Revocation is a DB update.

### No single-point-of-failure vendor lock-in

Every external dependency has a documented swap-out path:
- Privy → Turnkey (validated as backup during Week 1 spike).
- PayAI → Coinbase CDP (Tier-2 facilitator) → self-hosted (Tier-3).
- Helius → any Solana indexer; fallback mode is poll-only without realtime.
- Dodo → Razorpay (if expanding outside India).

---

## Where Payrail fits in the competitive landscape

- **Stripe + Bridge + Tempo + Agentic Commerce Protocol** — same vision, US-first, enterprise-targeted. Payrail's edge: India-first (UPI), developer-first (3-line SDK), runs on open x402 (not Stripe's proprietary MPP).
- **MoonPay Agents** — onramp for agents, global consumer. Payrail's edge: full payment rail, not just onramp; developer product.
- **Crossmint** — agent wallet infra, US-focused. Payrail's edge: India focus + agent-payment-specific vs. general-purpose wallet infra.
- **x402-native raw setup** — the DIY path. Payrail's edge: wraps away the wallet/gas/custody/fiat complexity. Same protocol under the hood; radically better developer UX.

The bet: **x402 becomes the HTTP of agent payments**. Whoever builds the best developer-UX wrapper wins the developer ecosystem. Payrail is that wrapper, India-first.

---

## One-paragraph summary, if that's all you read

Payrail lets an AI agent developer (Priya) add three lines of code and a UPI top-up to her agent, and have it autonomously pay API providers (Amit) per-request in USDC on Solana — while neither of them ever touches a wallet, manages gas, or learns what x402 is. The protocol under the hood is x402, an open HTTP payment standard using Solana stablecoins and a neutral facilitator (PayAI) that pays the gas fees. Payrail adds fiat on/off ramps (via Dodo), custody-as-a-service (via Privy delegated signing), spend-cap guardrails, and real-time dashboards (via Helius webhooks + SSE) to turn x402 from a protocol into a product both sides want to use.

---

## Reading the code yourself — a 20-minute guided tour

If you're a developer who wants to actually understand this codebase (not just the story), here's the path I'd take. About 20 minutes of reading.

### Stop 1 (2 min) — What an agent dev writes

Open [`apps/demo-agent/src/index.ts`](./apps/demo-agent/src/index.ts). This is a real, runnable agent that uses `@payrail/sdk` in a loop. Look at the imports and the `new Payrail(...)` + `agent.fetch(...)` calls. That's the entire Payrail integration. Everything else is demo dressing.

### Stop 2 (2 min) — What a merchant dev writes

Open [`apps/demo-merchant-news/src/index.ts`](./apps/demo-merchant-news/src/index.ts). Count the Payrail-specific lines — it's the `payrail(...)` factory call plus the `pay.charge(...)` middleware on each paid route. One line per endpoint, any price.

### Stop 3 (3 min) — Inside the client SDK

Open [`packages/sdk/src/index.ts`](./packages/sdk/src/index.ts). Trace `agent.fetch()`:
- First `fetch` to the merchant.
- `if (res.status === 402)` → extract `PAYMENT-REQUIRED` header, POST to Payrail's `/api/x402/sign` with the agent's `pk_…` key.
- Retry the original `fetch` with the `PAYMENT-SIGNATURE` header from the backend.

Three steps. That's all the SDK does.

### Stop 4 (3 min) — Inside the merchant SDK

Open [`packages/merchant-sdk/src/express.ts`](./packages/merchant-sdk/src/express.ts). Trace the middleware:
- No payment header? → call `handler.createPaymentRequirements()` (which asks PayAI's `/supported` for the facilitator's feePayer), return 402 with the encoded requirements.
- Payment header present? → `handler.verifyPayment()` then `handler.settlePayment()` (both POST to PayAI), attach the settlement sig to `X-Payment-Response`, call `next()` to run the downstream handler.

The `X402PaymentHandler` that does the heavy lifting lives in the `x402-solana` npm package — our middleware is a thin Express adapter on top.

### Stop 5 (5 min) — The heart: the sign route

Open [`apps/web/app/api/x402/sign/route.ts`](./apps/web/app/api/x402/sign/route.ts). Read the doc comment at the top, then the `POST` handler. Trace:
- `agentAuthGuard` → DB lookup by hashed API key.
- `validateRequirements` → policy checks on the merchant's 402.
- Atomic `UPDATE budgets SET spent_usdg = spent_usdg + amount WHERE ... + amount <= cap_usdg RETURNING id` — the real spend cap enforcement, in one SQL statement.
- `INSERT INTO transactions (status='pending')` — record intent before signing.
- `buildUnsignedX402PaymentTx()` → construct the Solana `VersionedTransaction`.
- `privy.walletApi.solana.signTransaction()` → delegated sign.
- `createPaymentPayload()` → base64-encode the signed tx for the SDK.

This single file contains the entire business logic of Payrail's "hot path."

### Stop 6 (2 min) — Transaction construction

Open [`apps/web/lib/x402-tx.ts`](./apps/web/lib/x402-tx.ts). See the exact instruction ordering (ComputeBudget 0, ComputeBudget 1, TransferChecked 2) the facilitator requires, and the ATA existence checks that enforce our merchant-ATA-init invariant.

### Stop 7 (3 min) — Custody: Privy delegated signing

Open [`apps/web/lib/privy-server.ts`](./apps/web/lib/privy-server.ts) — the singleton setup. Then [`apps/web/app/api/agents/route.ts`](./apps/web/app/api/agents/route.ts) and look at `createAgentWallet` — specifically the `additionalSigners: [{ signerId: env.PRIVY_AUTHORIZATION_KEY_ID }]` line. That's the pattern that makes server-side signing work. (Painful story: we initially used `authorizationKeyIds` which Privy silently ignored. The regression harness at [`scripts/spike-privy-variants.ts`](./scripts/spike-privy-variants.ts) documents this.)

### Stop 8 (2 min) — Treasury + top-up

Open [`apps/web/app/api/webhooks/dodo/route.ts`](./apps/web/app/api/webhooks/dodo/route.ts). This is Flow A — Dodo fires `payment.succeeded` → we move USDC from treasury to the agent's wallet via `transferSpl`. Note the pending-row-before-transfer pattern and the `TransferAlreadyLanded` / `TransferNeverLanded` self-healing logic.

### Stop 9 (2 min) — Realtime dashboard

Open [`apps/web/app/api/webhooks/helius/route.ts`](./apps/web/app/api/webhooks/helius/route.ts). The `confirmPendingTx` function is the match-and-flip logic. Then skim [`apps/web/lib/event-broker.ts`](./apps/web/lib/event-broker.ts) — the in-process SSE broker that pushes to the merchant dashboard.

### Stop 10 (optional) — Database schema

Open [`packages/db/src/schema.ts`](./packages/db/src/schema.ts). 10 tables, all with a comment explaining why they exist. Tables worth reading closely: `users`, `agents`, `budgets`, `agent_api_keys`, `transactions`, `merchants`, `webhook_log`.

### You're now oriented

If you've read those 10 files, you understand Payrail. Everything else in the repo is either UI (`apps/web/components`), routing/hooks (`apps/web/hooks` + `app/(user)`/`app/(merchant)` pages), or supporting infrastructure. The core story is the 10 files above.

### One-command local dev

```bash
git clone <repo>
cd payrail
pnpm install
cp .env.example .env  # fill in values — see README
pnpm db:push          # push Drizzle schema to Neon
pnpm dev              # turbo runs web + demo-agent + demo-merchant-news + SDK watchers
```

Open `http://localhost:3000` — sign in, create an agent, top up, paste its `pk_…` into `apps/demo-agent/.env`, run `pnpm --filter demo-agent dev`, and watch the agent pay the demo merchant on Solana devnet in real time.
