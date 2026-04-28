import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import { obscura } from "@obscura-app/merchant-sdk";

// The merchant's Umbra ETA address (Solana pubkey, base58). Derived
// server-side at merchant signup — copy it from your merchant dashboard
// or from /api/merchants/me into MERCHANT_ETA_ADDRESS in your .env.
const merchantEtaAddress = process.env.MERCHANT_ETA_ADDRESS;
if (!merchantEtaAddress) {
  throw new Error("MERCHANT_ETA_ADDRESS env is required");
}

// STABLECOIN_MINT must match the Obscura backend's STABLECOIN_MINT env. On
// devnet today we run the demo against WSOL (because Umbra's devnet doesn't
// support arbitrary mints yet); on mainnet this flips to USDC/USDG. Decimals
// follow the mint — WSOL=9, USDC/USDG=6.
const stablecoinMint = process.env.STABLECOIN_MINT;
if (!stablecoinMint) {
  throw new Error(
    "STABLECOIN_MINT env is required (must match the Obscura backend's STABLECOIN_MINT)",
  );
}
const stablecoinDecimals = Number(process.env.STABLECOIN_DECIMALS ?? "6");

const pay = obscura({
  merchantEtaAddress,
  network: "solana-devnet",
  mint: stablecoinMint,
  decimals: stablecoinDecimals,
  rpcUrl: process.env.HELIUS_RPC_URL,
});

const app = express();

// Request log + timing middleware. Runs BEFORE the merchant SDK's pay.charge
// so we see every inbound hit; we tag the response when it lands so 402 vs
// 200 are visible side-by-side. Without this, only settled (200) requests
// would log via `logSettlement`, and the 402 → retry round-trip would be
// invisible.
app.use((req: Request, res: Response, next: NextFunction) => {
  const startedAt = Date.now();
  console.log(`${time()} → ${req.method.padEnd(4)} ${req.path}`);
  res.on("finish", () => {
    const elapsed = `${(Date.now() - startedAt).toString().padStart(4)}ms`;
    if (res.statusCode === 402) {
      // First hop. SDK will retry shortly with the umbra-mixer-v1 envelope.
      console.log(`${time()} ← 402  ${req.path}            (payment required, ${elapsed})`);
    } else if (res.statusCode === 200) {
      const settlement = (
        res.locals as { obscuraSettlement?: { queueSignature: string } }
      ).obscuraSettlement;
      const sig = settlement?.queueSignature?.slice(0, 12);
      const tail = sig ? `queueSig=${sig}…  ${elapsed}` : `${elapsed}`;
      console.log(`${time()} ← 200  ${req.path}            ${tail}`);
    } else {
      console.log(`${time()} ← ${res.statusCode}  ${req.path}            ${elapsed}`);
    }
  });
  next();
});

// A tiny fixture store so the agent's "GET /article/:id" returns plausible
// varied content run-to-run without needing a real CMS behind it. Keeps the
// demo self-contained.
const ARTICLES = [
  { id: 47, headline: "Solana breaks 10k TPS again", tag: "infra" },
  { id: 48, headline: "Jupiter v3 launches routing engine", tag: "defi" },
  { id: 49, headline: "Helius launches Solana RPC pro tier", tag: "infra" },
  { id: 50, headline: "Coinbase acquires confidential payments startup", tag: "m&a" },
  { id: 51, headline: "USDG mint expands to 4 new chains", tag: "stables" },
];

// Cheapest paid endpoint — a list of headlines. Agent fetches this every
// cycle to decide what to read next.
app.get(
  "/headlines",
  pay.charge({ amount: "5000", description: "Headline list" }),
  (_req, res) => {
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
  res.json({
    ok: true,
    merchantEtaAddress,
    endpoints: ["/headlines", "/article/:id", "/digest"],
  });
});

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => {
  console.log("🛍️  demo-merchant-news\n");
  console.log(`   URL:        http://localhost:${port}`);
  console.log(`   Merchant:   ${merchantEtaAddress}`);
  console.log(`   Pricing:    /headlines 0.005 · /article 0.010 · /digest 0.015`);
  console.log(`   Mint:       ${stablecoinMint} (${stablecoinDecimals} decimals)`);
  console.log(`   Health:     http://localhost:${port}/health`);
  console.log("");
  console.log("Waiting for requests… (Ctrl-C to stop)\n");
});

function time(): string {
  return new Date().toTimeString().slice(0, 8);
}
