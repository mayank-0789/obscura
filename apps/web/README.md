# apps/web — Obscura backend + frontend

Next.js app that hosts everything Obscura's website-visible: marketing, agent + merchant dashboards, the in-app `/docs`, the `/demo` playground, and every API route under `/api/**` (auth, x402 sign, top-up, webhooks, cron).

This is **not** a standalone project. It's a workspace inside the monorepo. For architecture, run instructions, and env variables, read the root [`README.md`](../../README.md). For Umbra specifics, read [`UMBRA-DEPS.md`](../../UMBRA-DEPS.md) at the root.

## Common commands (run from monorepo root)

```bash
pnpm install           # install everything
pnpm dev               # next dev — full app at http://localhost:3000
pnpm typecheck         # tsc --noEmit across workspace
pnpm lint              # ESLint
pnpm build             # production build (turbo runs build for every package)
```

## Layout (high level)

- `app/(merchant)`, `app/(user)` — route groups for the two dashboards.
- `app/api/**` — every server route. The serious money paths are `api/x402/sign`, `api/webhooks/dodo`, `api/webhooks/helius`, `api/cron/{claim-daemon,reconcile}`.
- `app/docs/**` — in-app documentation (MDX).
- `app/demo` — the judge-facing live mixer demo.
- `lib/umbra.ts` — central wrapper around `@umbra-privacy/sdk`. Most other code goes through this.
- `lib/env.ts` — Zod-validated environment.

If anything in this README contradicts the root README, the root wins.
