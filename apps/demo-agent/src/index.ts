import "dotenv/config";
import { Obscura, ObscuraError } from "@obscura-app/sdk";

// Demo agent — a "news reader" that autonomously buys headlines + articles
// from the demo merchant via Obscura. Loops forever (Ctrl-C to stop).

const API_KEY = process.env.OBSCURA_KEY;
const BASE_URL = process.env.OBSCURA_BASE_URL ?? "http://localhost:3000";
const MERCHANT_URL = process.env.MERCHANT_URL ?? "http://localhost:3001";
const CYCLE_MS = Number(process.env.CYCLE_MS ?? 25_000);

if (!API_KEY) {
  console.error("❌ OBSCURA_KEY missing in .env");
  process.exit(1);
}

const agent = new Obscura({ apiKey: API_KEY, baseUrl: BASE_URL });

type Headline = { id: number; headline: string };

let cycle = 0;
let totalSpentMicros = 0n;
let stopping = false;

process.on("SIGINT", () => {
  if (stopping) process.exit(1);
  stopping = true;
  console.log("\n\n🛑 stopping after current cycle…");
});

async function runCycle() {
  cycle += 1;
  const startedAt = Date.now();
  console.log(`\n${time()} 🤖 cycle #${cycle}  ·  total spent ${usdc(totalSpentMicros)}`);

  console.log(`\n${time()} → GET /headlines`);
  const t0 = Date.now();
  const headlinesRes = await agent.fetch(`${MERCHANT_URL}/headlines`);
  await logResult(headlinesRes, "/headlines", 5_000n, t0);
  if (!headlinesRes.ok) return;

  const { headlines } = (await headlinesRes.json()) as {
    headlines: Headline[];
  };
  console.log(`${pad()}${headlines.length} headlines returned`);

  const picks = pickRandom(headlines, Math.random() < 0.3 ? 1 : 2);
  for (const pick of picks) {
    console.log(`\n${time()} → GET /article/${pick.id}    "${pick.headline.slice(0, 38)}…"`);
    const tA = Date.now();
    const articleRes = await agent.fetch(`${MERCHANT_URL}/article/${pick.id}`);
    await logResult(articleRes, `/article/${pick.id}`, 10_000n, tA);
  }

  if (Math.random() < 0.25) {
    console.log(`\n${time()} → GET /digest    (premium briefing)`);
    const tD = Date.now();
    const digestRes = await agent.fetch(`${MERCHANT_URL}/digest`);
    await logResult(digestRes, "/digest", 15_000n, tD);
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n${time()} ✓ cycle #${cycle} done in ${elapsed}s`);
}

async function logResult(
  res: Response,
  label: string,
  priceMicros: bigint,
  startedAt: number,
) {
  const took = `${Date.now() - startedAt}ms`;
  if (res.ok) {
    totalSpentMicros += priceMicros;
    // Extract queue signature from umbra-mixer-v1 settlement envelope for log breadcrumb.
    const sig = res.headers.get("x-payment-response");
    const sigShort = sig
      ? Buffer.from(sig, "base64")
          .toString()
          .match(/"queueSignature":"([^"]+)"/)
          ?.[1]
          ?.slice(0, 12) ?? "?"
      : "?";
    console.log(
      `${pad()}← 200  paid ${usdc(priceMicros)}  queueSig ${sigShort}…  ${took}`,
    );
    return;
  }
  const bodyText = await res.text().catch(() => "");
  console.log(`${pad()}← ${res.status} ${res.statusText}  ${took}  ${bodyText.slice(0, 100)}`);
}

async function main() {
  console.log("🤖  Obscura demo agent — news reader\n");
  console.log(`   API key:   ${API_KEY!.slice(0, 8)}…${API_KEY!.slice(-4)}`);
  console.log(`   Obscura:   ${BASE_URL}`);
  console.log(`   Merchant:  ${MERCHANT_URL}`);
  console.log(`   Cadence:   one cycle every ${CYCLE_MS / 1000}s`);
  console.log(`   Stop:      Ctrl-C\n`);
  console.log("─".repeat(64));

  while (!stopping) {
    try {
      await runCycle();
    } catch (err) {
      if (err instanceof ObscuraError) {
        if (err.code === "over_cap") {
          console.log(
            `\n💸 budget cap reached — shutting down gracefully after ${cycle} cycles`,
          );
          process.exit(0);
        }
        if (err.code === "insufficient_funds") {
          console.log(
            `\n💸 insufficient encrypted balance — agent needs a top-up. Stopping after ${cycle} cycles.`,
          );
          process.exit(0);
        }
        console.error(
          `\n⚠ ObscuraError (${err.code}${err.status ? `, status=${err.status}` : ""}): ${err.message}`,
        );
      } else {
        console.error("\n⚠ cycle threw:", err);
      }
    }
    if (stopping) break;
    await sleep(CYCLE_MS);
  }

  console.log(
    `\n📊 summary: ${cycle} cycles · total spent ${usdc(totalSpentMicros)}\n`,
  );
  process.exit(0);
}

function time(): string {
  return new Date().toTimeString().slice(0, 8);
}

function pad(): string {
  return "           ";
}

function usdc(micros: bigint): string {
  const whole = micros / 1_000_000n;
  const frac = (micros % 1_000_000n).toString().padStart(6, "0");
  return `${whole}.${frac} USDC`;
}

function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < Math.min(n, arr.length); i += 1) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy[idx]!);
    copy.splice(idx, 1);
  }
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

void main();
