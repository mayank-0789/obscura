# @payrail/sdk

Client SDK for AI agents to autonomously pay for APIs via X402 on Solana.

Drop this into your agent's code and any paid API becomes callable transparently — the SDK handles the X402 payment handshake, signs the Solana transaction on the backend, and retries the request with a valid payment header.

> **Status:** early development. API is not stable.

## What it does (once we build it)

```ts
import { Payrail } from '@payrail/sdk';

const agent = new Payrail({
  agentId: 'agt_...',
  apiKey: process.env.PAYRAIL_API_KEY!,
});

// Works exactly like fetch(), but auto-pays on 402 responses.
const response = await agent.fetch('https://premium-news-api.com/article/123');
const data = await response.json();
```

## Docs

Full documentation will be hosted at [payrail.sh/docs/users](https://payrail.sh/docs/users) once ready.
