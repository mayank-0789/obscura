# @payrail/merchant-sdk

Server middleware for API providers to accept per-call payments from AI agents in USDG on Solana.

Wrap any route with our middleware and it becomes pay-per-call. Payments settle on Solana via the X402 protocol; optional fiat cash-out via Dodo Payments.

> **Status:** early development. API is not stable.

## What it does (once we build it)

```ts
import express from 'express';
import { payrail } from '@payrail/merchant-sdk';

const app = express();

const pay = payrail({
  merchantId: 'merch_...',
  apiKey: process.env.PAYRAIL_SECRET!,
});

// Charge 0.02 USDG per call on this route.
app.get(
  '/premium-article/:id',
  pay.charge({ amount: '0.02' }),
  async (req, res) => {
    const article = await db.articles.find(req.params.id);
    res.json(article);
  }
);
```

## Docs

Full documentation will be hosted at [payrail.sh/docs/merchants](https://payrail.sh/docs/merchants) once ready.
