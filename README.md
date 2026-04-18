# Payrail

> **The payment rail for AI agents.** Fund with UPI or card via Dodo Payments. Agents spend stablecoins autonomously on Solana via the X402 protocol.

Built for the **Colosseum Solana Frontier Hackathon 2026** + **Superteam India × Dodo Payments** side track.

🌐 [payrail.sh](https://payrail.sh) · Solana × Dodo Payments

---

## The problem

AI agents can't cleanly pay for things today. They can't swipe credit cards, and while Solana's [X402 protocol](https://solana.com/docs/payments/agentic-payments) now lets them pay per-call in stablecoins, there's no simple way for a regular user — especially in India — to get money into an agent's wallet without first owning crypto.

## What Payrail does

Users top up their agent with UPI or card through Dodo Payments. Funds arrive as USDG stablecoins in the agent's Solana wallet within seconds. The agent uses our drop-in client SDK to transparently handle X402 payment handshakes every time it hits a paid API or MCP server. API providers use our merchant SDK to accept per-call payments in one line of server middleware.

---

## The three roles

Payrail has three distinct roles:

| Role | Description | Uses our web app? | Integrates with |
|---|---|---|---|
| 👤 **User** | Human developer who funds and runs AI agents | Yes — signup, dashboard, top-up | `@payrail/sdk` (drops into their agent code) |
| 🤖 **Agent** | Autonomous program that spends stablecoins per call | No — it's code, uses API keys | Our backend's `/api/x402/sign` |
| 🏪 **Merchant** | Human running a paid API/MCP server | Yes — separate merchant signup | `@payrail/merchant-sdk` (wraps their routes) |

## Product flow

1. User signs up → creates an agent → tops up with UPI via Dodo Payments
2. Dodo webhook fires → our backend transfers USDG from treasury → agent's dedicated Solana wallet
3. User drops `@payrail/sdk` into their agent's code
4. Agent hits paid APIs → SDK handles the X402 payment dance automatically (sign on Solana, retry with `X-Payment` header)
5. Merchants running `@payrail/merchant-sdk` middleware earn USDG per call, with optional fiat cash-out via Dodo payouts

---

## Tech stack

| Layer | Choice |
|---|---|
| Monorepo | [Turborepo](https://turbo.build) + [pnpm workspaces](https://pnpm.io/workspaces) |
| Frontend + Backend | [Next.js 16](https://nextjs.org) (App Router) — route handlers power the backend |
| Language | TypeScript (strict) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com) |
| Database | [Neon](https://neon.tech) (serverless Postgres) + [Drizzle ORM](https://orm.drizzle.team) |
| Auth + Wallets | [Privy](https://privy.io) — embedded wallets (per-agent isolation) |
| Fiat payments | [Dodo Payments](https://dodopayments.com) — Merchant of Record, webhooks, subscriptions |
| Solana RPC | [Helius](https://helius.dev) |
| Stablecoin | [USDG](https://paxos.com/usdg/) (Paxos, regulated) |
| X402 facilitator | [PayAI](https://payai.network) (wrapped) |
| Runtime validation | [Zod](https://zod.dev) |
| Deploy | [Vercel](https://vercel.com) |

---

## Monorepo layout

```
payrail/
├── apps/
│   ├── web/                             # main product (user UI + merchant UI + API routes)
│   ├── demo-merchant-news/              # demo merchant #1 — paid news API, deployed externally
│   └── demo-merchant-weather/           # demo merchant #2 — paid weather API, deployed externally
├── packages/
│   ├── types/                           # @payrail/types — shared TS types
│   ├── db/                              # @payrail/db — Drizzle schema + client
│   ├── solana/                          # @payrail/solana — Solana helpers + constants
│   ├── sdk/                             # @payrail/sdk — client SDK (drop into agent code)
│   ├── merchant-sdk/                    # @payrail/merchant-sdk — server middleware
│   ├── eslint-config/                   # shared ESLint config
│   └── typescript-config/               # shared TypeScript config
├── scripts/                             # one-off scripts: treasury seeding, local testing
├── turbo.json                           # turbo task graph
├── pnpm-workspace.yaml                  # workspace definition
└── package.json                         # root (name: "payrail")
```

### Which code lives where (DRY rule)

> **A package exists only if 2+ consumers use it. Single-consumer code stays local to its app.**

Shared (in `packages/`):
- `types` — used by web, sdk, merchant-sdk, scripts (4 consumers)
- `db` — used by web + scripts (2 consumers)
- `solana` — used by web + merchant-sdk + scripts (3 consumers)
- `sdk` / `merchant-sdk` — standalone, published externally

Local (in `apps/web/lib/`):
- `dodo/` — only web uses Dodo
- `privy/` — only web uses Privy server SDK
- `policy/` — spend-cap enforcement (app-specific)
- `ratelimit/` — rate limiting for public endpoints

---

## Getting started

> ⚠️ Work in progress — this repo is actively being built for the hackathon.

```bash
# 1. install deps
pnpm install

# 2. configure env (coming soon)
cp .env.example .env.local

# 3. push schema to Neon (coming soon)
pnpm db:push

# 4. run everything in parallel
pnpm dev
```

Open http://localhost:3000.

## Scripts

| Script | Purpose |
|---|---|
| `pnpm dev` | Run all apps in parallel (via turbo) |
| `pnpm build` | Build all packages (respects dependency graph) |
| `pnpm check-types` | TypeScript check across all packages |
| `pnpm lint` | Lint all packages |
| `pnpm format` | Format with Prettier |

Filter a single app/package:

```bash
pnpm dev --filter=web
pnpm build --filter=@payrail/sdk
```

---

## Hackathon deadlines

- **Build deadline (internal):** May 7, 2026
- **Colosseum Frontier hard deadline:** May 11, 2026
- **Winner announcement:** May 26, 2026

## Status

🚧 Scaffold in place (Turborepo + empty folder structure). Next up: detailed HLD review, then wire up Privy + Dodo + Drizzle + Solana in that order.

---

## License

MIT — see [LICENSE](./LICENSE).
