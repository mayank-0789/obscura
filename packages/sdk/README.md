# @obscura-app/sdk

Pay-per-call SDK for AI agents. Wraps `fetch()` so any x402-enabled paid API becomes callable transparently — the SDK handles the payment handshake, signs the Solana transaction server-side via Obscura, and retries the request with a valid payment header.

Your agent never touches a private key, a blockchain library, or a wallet file. It just needs an API key.

## Install

```bash
npm install @obscura-app/sdk
# or: pnpm add @obscura-app/sdk
# or: yarn add @obscura-app/sdk
```

## Quickstart

```ts
import { Obscura } from "@obscura-app/sdk";

const agent = new Obscura({
  apiKey: process.env.OBSCURA_KEY!,
  baseUrl: process.env.OBSCURA_BASE_URL!, // e.g. https://<your-app>.up.railway.app
});

const res = await agent.fetch(
  "https://your-merchant.example.com/article/42",
);
const data = await res.json();
```

That's it. The SDK calls the URL; if the merchant returns `402 Payment Required`, the SDK signs payment on your behalf via Obscura and retries. Your code sees a normal `Response`.

## API

### `new Obscura(options)`

| Option             | Type           | Default            | Description                                                                                                                                                                       |
| ------------------ | -------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apiKey`           | `string`       | **required**       | Agent API key from the Obscura dashboard (`pk_…`).                                                                                                                                |
| `baseUrl`          | `string`       | **required**       | URL of the Obscura backend that signs your payments (the host of your deployed `apps/web`).                                                                                       |
| `fetch`            | `typeof fetch` | `globalThis.fetch` | Inject a custom fetch (undici, mocks, proxies).                                                                                                                                   |
| `signTimeoutMs`    | `number`       | `60_000`           | Per-request timeout for `/api/x402/sign`. Cold-path P99 lands ~45s (Groth16 prove + Arcium MPC callback); the default leaves headroom without leaving zombie requests forever.    |
| `signMaxRetries`   | `number`       | `2`                | Retry attempts on transient failures (network errors, 5xx, timeouts). Terminal codes (`over_cap`, `signing_failed`, `timeout`, `conflict`, etc.) are never retried.               |
| `signRetryBaseMs`  | `number`       | `500`              | Initial backoff before the first retry; doubles each subsequent attempt, capped at 8s.                                                                                            |

### `agent.fetch(url, init?)`

Same signature as the native `fetch`. Returns the final `Response` — either the merchant's direct response (non-402), or the paid-and-retried response (after 402).

Throws `ObscuraError` on any sign-flow failure.

### `ObscuraError`

```ts
import { ObscuraError } from "@obscura-app/sdk";

try {
  const res = await agent.fetch(url);
} catch (err) {
  if (err instanceof ObscuraError) {
    switch (err.code) {
      case "over_cap":        // agent's monthly spend cap hit
      case "agent_inactive":  // agent paused/cancelled
      case "invalid_token":   // API key revoked / wrong
      case "network_error":   // couldn't reach Obscura backend
      // …
    }
  }
}
```

Full list of codes is in the exported `ObscuraErrorCode` union.

## How it works

```
your code              paid API              obscura              umbra/solana
    │                     │                     │                       │
    │ agent.fetch(url)    │                     │                       │
    │────────────────────▶│                     │                       │
    │ 402 + PAYMENT-REQD  │                     │                       │
    │◀────────────────────│                     │                       │
    │                     │                     │                       │
    │ POST /api/x402/sign │                     │                       │
    │──────────────────────────────────────────▶│                       │
    │                     │       ┌─ cap check ─┤                       │
    │                     │       ├─ mixer xfer ┼─────────────────────▶│
    │                     │       │             │                       │
    │                     │       │             │   queue + callback    │
    │                     │       │             │◀──────────────────────│
    │ { paymentSignatureHeader (umbra-mixer-v1) }                       │
    │◀──────────────────────────────────────────│                       │
    │                     │                     │                       │
    │ retry w/ sig        │                     │                       │
    │────────────────────▶│                     │                       │
    │                     │ verify on-chain via RPC                     │
    │                     ├────────────────────────────────────────────▶│
    │                     │◀──── queue tx confirmed ────────────────────│
    │ 200 + data          │                     │                       │
    │◀────────────────────│                     │                       │
```

- Signing is server-side via Obscura-derived keypairs (HMAC-SHA-256 of a master seed + the agent's UUID). No key material in your agent's process. No wallet popup.
- Spend caps are enforced atomically on every sign call. No over-spend under concurrency.
- The actual transfer is a confidential Umbra mixer hop: agent's encrypted balance → on-chain UTXO → merchant's encrypted balance. The on-chain link between sender and recipient is broken by the mixer commitment. Amounts are encrypted at rest.
- Neither your agent nor the merchant ever needs SOL — the Obscura backend pays for the deposit, the Umbra relayer pays for the claim.

## Environment

The SDK needs `globalThis.fetch` (Node 18+ ships it). Older Node / edge runtimes: pass a polyfill via the `fetch` option.

## Support

Issues: [github.com/mayank-0789/obscura/issues](https://github.com/mayank-0789/obscura/issues)

## License

MIT
