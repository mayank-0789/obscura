import "dotenv/config";
import express from "express";
import { payrail } from "@payrail-app/merchant-sdk";

const payoutWallet = process.env.PAYOUT_WALLET;
if (!payoutWallet) {
  throw new Error("PAYOUT_WALLET env is required");
}

const pay = payrail({
  payoutWallet,
  network: "solana-devnet",
  rpcUrl: process.env.HELIUS_RPC_URL,
});

const app = express();

// A tiny fixture store so the agent's "GET /article/:id" returns plausible
// varied content run-to-run without needing a real CMS behind it. Keeps the
// demo self-contained.
const ARTICLES = [
  { id: 47, headline: "Solana breaks 10k TPS again", tag: "infra" },
  { id: 48, headline: "Jupiter v3 launches routing engine", tag: "defi" },
  { id: 49, headline: "Helius launches Solana RPC pro tier", tag: "infra" },
  { id: 50, headline: "Stripe acquires Privy for $400M", tag: "m&a" },
  { id: 51, headline: "USDG mint expands to 4 new chains", tag: "stables" },
];

function logSettlement(label: string, res: express.Response) {
  const settlement = (res.locals as { payrailSettlement?: { transaction: string } })
    .payrailSettlement;
  const sig = settlement?.transaction?.slice(0, 12) ?? "?";
  console.log(`   ✓ ${label.padEnd(12)} · sig=${sig}…`);
}

// Cheap preview — a list of headlines. Shown as the "fast scan" endpoint
// the demo agent calls first every cycle.
app.get(
  "/headlines",
  pay.charge({ amount: "5000", description: "Headline list" }),
  (_req, res) => {
    logSettlement("/headlines", res);
    res.json({
      at: new Date().toISOString(),
      count: ARTICLES.length,
      headlines: ARTICLES.map((a) => ({ id: a.id, headline: a.headline })),
    });
  },
);

// Mid-price — full article body. The agent fetches this after seeing a
// headline it "finds interesting."
app.get(
  "/article/:id",
  pay.charge({ amount: "10000", description: "Full article body" }),
  (req, res) => {
    logSettlement("/article", res);
    const id = Number(req.params.id);
    const article =
      ARTICLES.find((a) => a.id === id) ?? {
        id,
        headline: `Dummy article #${id}`,
        tag: "misc",
      };
    res.json({
      ...article,
      body:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. " +
        "Solana's latest throughput milestone crossed 10,000 TPS under " +
        "sustained mainnet load during a stress test…",
      publishedAt: new Date().toISOString(),
    });
  },
);

// Premium — hand-written digest across multiple articles. Agent calls
// this less often because it's the most expensive.
app.get(
  "/digest",
  pay.charge({ amount: "15000", description: "Editor-curated digest" }),
  (_req, res) => {
    logSettlement("/digest", res);
    res.json({
      at: new Date().toISOString(),
      digest:
        "Solana ecosystem moves: throughput milestone at 10k TPS, Jupiter " +
        "ships a new routing engine, Helius expands its RPC pro tier. " +
        "Watch stablecoin mint expansion for cross-chain flows.",
      articleIds: ARTICLES.slice(0, 3).map((a) => a.id),
    });
  },
);

app.get("/health", (_req, res) => {
  res.json({ ok: true, payoutWallet, endpoints: ["/headlines", "/article/:id", "/digest"] });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log("🛍️  demo-merchant-news\n");
  console.log(`   URL:      http://localhost:${port}`);
  console.log(`   Payout:   ${payoutWallet}`);
  console.log(`   Pricing:  /headlines 0.005 · /article 0.010 · /digest 0.015 USDC`);
  console.log(`   Health:   http://localhost:${port}/health\n`);
  console.log("Waiting for requests… (Ctrl-C to stop)");
});
