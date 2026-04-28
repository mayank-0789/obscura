# @obscura-app/merchant-sdk

Server middleware for API sellers who want to accept **confidential** pay-per-call x402 payments on Solana. Drop one line into your Express-style route; the SDK returns `402 Payment Required` until the agent pays via the Umbra mixer, verifies the on-chain proofs that arrive on retry, and then lets your handler run.

The agent's payment flows through Umbra's encrypted token accounts and the on-chain mixer. Your server never sees an SPL transfer — it sees an encrypted `umbra-mixer-v1` envelope, verifies the on-chain proofs via Solana RPC, and serves your content. The actual encrypted-balance credit on your side settles asynchronously when your claim daemon picks up the receiver-claimable UTXO.

## Install

```bash
npm install @obscura-app/merchant-sdk
# or: pnpm add @obscura-app/merchant-sdk
# or: yarn add @obscura-app/merchant-sdk
```

`@solana/web3.js >= 1.98.4` is a peer dependency — install it alongside if your project doesn't already have it.

## Quickstart

```ts
import express from "express";
import { obscura } from "@obscura-app/merchant-sdk";

const pay = obscura({
  // Your Umbra-side ETA address — register once via
  // `pnpm umbra:bootstrap-merchant <id>` and copy the printed address here.
  merchantEtaAddress: process.env.MERCHANT_ETA_ADDRESS!,
  network: "solana-devnet",                    // or "solana"
  rpcUrl: process.env.HELIUS_RPC_URL,          // any Solana RPC works
});

const app = express();

app.get(
  "/article/:id",
  pay.charge({ amount: "10000" }),  // 10000 atomic units
  (req, res) => {
    res.json({ id: req.params.id, text: "…" });
  },
);

app.listen(3000);
```

## API

### `obscura(config)`

| Option               | Type                          | Default                | Description                                                                       |
| -------------------- | ----------------------------- | ---------------------- | --------------------------------------------------------------------------------- |
| `merchantEtaAddress` | `string`                      | **required**           | Your Umbra-side ETA address (Solana pubkey, base58). NOT a regular SPL wallet.    |
| `network`            | `"solana" \| "solana-devnet"` | `"solana-devnet"`      | Which network to advertise + verify against.                                      |
| `mint`               | `string`                      | devnet/mainnet USDC    | SPL token mint to accept. Must match the Obscura backend's `STABLECOIN_MINT`.     |
| `decimals`           | `number`                      | `6`                    | Decimals for the mint (USDC + USDG both use 6; WSOL uses 9).                      |
| `rpcUrl`             | `string`                      | Solana public          | RPC endpoint for on-chain envelope verification.                                  |
| `replayWindowMs`     | `number`                      | `300_000` (5 min)      | How long a queue signature is remembered to block replay.                         |

Returns a `{ charge(config) }` factory.

### `pay.charge(config)`

Returns an Express-compatible middleware.

| Option              | Type                                    | Description                                                 |
| ------------------- | --------------------------------------- | ----------------------------------------------------------- |
| `amount`            | `string` (atomic units, e.g. `"10000"`) | **Required.** Price per call.                               |
| `description`       | `string`                                | Human-readable description in the 402 body.                 |
| `mimeType`          | `string`                                | Response MIME advertised. Default `application/json`.       |
| `maxTimeoutSeconds` | `number`                                | Max client wait for payment. Default 300.                   |
| `asset`             | `{ address, decimals }`                 | Override the SDK-default mint for this route only.          |

On a verified envelope, the middleware:
- attaches the `umbra-mixer-v1` settlement envelope as a base64 `X-Payment-Response` header (carries `queueSignature`, `callbackSignature`, `recipient`, `amount`, `asset`)
- exposes the parsed envelope at `res.locals.obscuraSettlement` (Express)
- calls `next()` so your downstream handler runs

## How it works

```
agent SDK              your server              solana
    │                       │                       │
    │ GET /article/42       │                       │
    │──────────────────────▶│                       │
    │                       │ (no payment header)   │
    │ 402 + PAYMENT-REQUIRED│                       │
    │◀──────────────────────│                       │
    │                       │                       │
    │ retry w/ PAYMENT-SIG  │                       │
    │──────────────────────▶│                       │
    │                       │ getTransaction(queueSig)
    │                       ├──────────────────────▶│
    │                       │◀── tx.meta.err: null ─│
    │                       │                       │
    │                       │ verify envelope:      │
    │                       │   recipient == me?    │
    │                       │   asset == mint?      │
    │                       │   amount + resource match?
    │                       │   queueSig not seen?  │
    │                       │                       │
    │                       │ your handler runs     │
    │ 200 + data + X-Payment-Response               │
    │◀──────────────────────│                       │
```

- **No facilitator.** The Umbra deposit instruction enforces consistency on-chain; a successful queue tx is the source of truth. Your server is the only thing in the verify path.
- **Settlement is implicit.** By the time the agent presents the envelope, the encrypted balance has already been deducted from the sender's ETA via Arcium MPC, and a UTXO addressed to your ETA sits in the mixer tree. Your downstream claim daemon picks it up and credits your encrypted balance.
- **Replay protection.** Each queue signature is single-use within a 5-minute window per process.
- **No SOL needed.** Neither the agent nor your server pays Solana gas — the Obscura backend does for the deposit, and the Umbra relayer does for the claim.

## Bootstrapping your merchant ETA

The merchant ETA is a deterministic Solana keypair derived from a master seed + your merchant ID. Run once:

```bash
pnpm umbra:bootstrap-merchant my-merchant-id
```

This funds the derived address with SOL from treasury, registers it on Umbra (confidential + anonymous), and prints the ETA address to copy into your `.env` as `MERCHANT_ETA_ADDRESS`.

## Support

Issues: [github.com/mayank-0789/obscura/issues](https://github.com/mayank-0789/obscura/issues)

## License

MIT
