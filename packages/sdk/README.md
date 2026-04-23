# @payrail/sdk

Pay-per-call SDK for AI agents. Wraps `fetch()` so any x402-enabled paid API becomes callable transparently — the SDK handles the payment handshake, signs the Solana transaction server-side via Payrail, and retries the request with a valid payment header.

Your agent never touches a private key, a blockchain library, or a wallet file. It just needs an API key.

## Install

During the private beta, install from GitHub (we'll publish to npm at launch). See the [agent quickstart](https://payrail.sh/docs/users/quickstart) for the install command that matches your package manager.

## Quickstart

```ts
import { Payrail } from "@payrail/sdk";

const agent = new Payrail({
  apiKey: process.env.PAYRAIL_KEY!,
});

const res = await agent.fetch(
  "https://demo-merchant-news.payrail.sh/article/42",
);
const data = await res.json();
```

That's it. The SDK calls the URL; if the merchant returns `402 Payment Required`, the SDK signs payment on your behalf via Payrail and retries. Your code sees a normal `Response`.

## API

### `new Payrail(options)`

| Option    | Type           | Default                 | Description                                                           |
| --------- | -------------- | ----------------------- | --------------------------------------------------------------------- |
| `apiKey`  | `string`       | **required**            | Agent API key from the Payrail dashboard (`pk_…`).                    |
| `baseUrl` | `string`       | `"https://payrail.sh"`  | Override for self-hosted / staging / local dev.                       |
| `fetch`   | `typeof fetch` | `globalThis.fetch`      | Inject a custom fetch (undici, mocks, proxies).                       |

### `agent.fetch(url, init?)`

Same signature as the native `fetch`. Returns the final `Response` — either the merchant's direct response (non-402), or the paid-and-retried response (after 402).

Throws `PayrailError` on any sign-flow failure.

### `PayrailError`

```ts
import { PayrailError } from "@payrail/sdk";

try {
  const res = await agent.fetch(url);
} catch (err) {
  if (err instanceof PayrailError) {
    switch (err.code) {
      case "over_cap":        // agent's monthly spend cap hit
      case "agent_inactive":  // agent paused/cancelled
      case "invalid_token":   // API key revoked / wrong
      case "network_error":   // couldn't reach Payrail backend
      // …
    }
  }
}
```

Full list of codes is in the exported `PayrailErrorCode` union.

## How it works

```
your code              paid API              payrail              solana
    │                     │                     │                    │
    │ agent.fetch(url)    │                     │                    │
    │────────────────────▶│                     │                    │
    │ 402 + PAYMENT-REQD  │                     │                    │
    │◀────────────────────│                     │                    │
    │                     │                     │                    │
    │ POST /api/x402/sign │                     │                    │
    │──────────────────────────────────────────▶│                    │
    │                     │       ┌─ cap check ─┤                    │
    │                     │       ├─ privy sign ┤                    │
    │ { paymentSignatureHeader }                │                    │
    │◀──────────────────────────────────────────│                    │
    │                     │                     │                    │
    │ retry w/ sig        │                     │                    │
    │────────────────────▶│                     │                    │
    │                     │ verify + settle via PayAI facilitator   │
    │                     ├────────────────────────────────────────▶│
    │                     │            tx settled                    │
    │                     │◀────────────────────────────────────────│
    │ 200 + data          │                     │                    │
    │◀────────────────────│                     │                    │
```

- Signing is server-side via Privy delegated signers. No key material in your agent's process.
- Spend caps are enforced atomically on every sign call. No over-spend under concurrency.
- The on-chain tx is co-signed by the PayAI facilitator as the fee payer. Your agent never needs SOL.

## Environment

The SDK needs `globalThis.fetch` (Node 18+ ships it). Older Node / edge runtimes: pass a polyfill via the `fetch` option.

## Support

Docs: [payrail.sh/docs](https://payrail.sh/docs) · Issues: [github.com/payrail/payrail/issues](https://github.com/payrail/payrail/issues)

## License

MIT
