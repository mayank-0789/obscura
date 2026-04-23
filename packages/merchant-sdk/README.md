# @payrail-app/merchant-sdk

Server middleware for API sellers who want to accept pay-per-call x402 payments. Drop one line into your Express-style route; the SDK returns `402 Payment Required` until the client pays, verifies + settles the Solana transaction via the PayAI facilitator, and then lets your handler run.

The facilitator co-signs as the fee-payer, so **your users never need SOL** — they only need USDC to pay for the call.

## Install

During the private beta, install from GitHub (we'll publish to npm at launch). See the [merchant quickstart](https://payrail.sh/docs/merchants/quickstart) for the install command that matches your package manager.

## Quickstart

```ts
import express from "express";
import { payrail } from "@payrail-app/merchant-sdk";

const pay = payrail({
  payoutWallet: process.env.PAYOUT_WALLET!,  // Solana pubkey where USDC lands
  network: "solana-devnet",                  // or "solana"
});

const app = express();

app.get(
  "/article/:id",
  pay.charge({ amount: "10000" }),  // 10000 atomic units = $0.01 USDC
  (req, res) => {
    res.json({ id: req.params.id, text: "…" });
  },
);

app.listen(3000);
```

Test locally with the Payrail-hosted facilitator — no API key needed on PayAI's free tier.

## API

### `payrail(config)`

| Option                       | Type                          | Default             | Description                                             |
| ---------------------------- | ----------------------------- | ------------------- | ------------------------------------------------------- |
| `payoutWallet`               | `string`                      | **required**        | Solana pubkey (base58) where payments land.             |
| `network`                    | `"solana" \| "solana-devnet"` | `"solana-devnet"`   | Which network to settle on.                             |
| `mint`                       | `string`                      | devnet/mainnet USDC | SPL token mint to accept.                               |
| `decimals`                   | `number`                      | `6`                 | Decimals for the mint (USDC + USDG both use 6).         |
| `facilitatorUrl`             | `string`                      | PayAI public        | Override to self-host or switch providers.              |
| `rpcUrl`                     | `string`                      | Solana public       | RPC endpoint for chain reads.                           |
| `apiKeyId` + `apiKeySecret`  | `string`                      | —                   | PayAI paid-tier JWT auth (optional).                    |

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

On successful settlement, the middleware:
- attaches the facilitator's settlement result as a base64 `X-Payment-Response` header
- exposes the parsed settlement at `res.locals.payrailSettlement` (Express)
- calls `next()` so your downstream handler runs with everything in place

## How it works

```
client (agent)          your server            PayAI facilitator
    │                        │                        │
    │  GET /article/42       │                        │
    │───────────────────────▶│                        │
    │                        │ (no payment header)    │
    │  402 + PAYMENT-REQUIRED│                        │
    │◀───────────────────────│                        │
    │                        │                        │
    │  retry w/ PAYMENT-SIG  │                        │
    │───────────────────────▶│                        │
    │                        │  POST /verify          │
    │                        │───────────────────────▶│
    │                        │◀─── isValid: true ─────│
    │                        │  POST /settle          │
    │                        │───────────────────────▶│
    │                        │◀─── tx signature ──────│
    │                        │                        │
    │                        │  your handler runs     │
    │  200 + data + X-Payment-Response                │
    │◀───────────────────────│                        │
```

- **Settle-before-flush**: the middleware waits for settlement (~500ms) before calling your handler. That gives you the tx signature in time to attach it to the response.
- **Fee payer = facilitator**: PayAI pays the Solana gas, so your buyers don't need SOL.
- **Replay protection**: x402's challenge nonce + the facilitator's de-dup guarantee each signed payment settles exactly once.

## Support

Docs: [payrail.sh/docs/merchants](https://payrail.sh/docs/merchants)  ·  Issues: [github.com/payrail/payrail/issues](https://github.com/payrail/payrail/issues)

## License

MIT
