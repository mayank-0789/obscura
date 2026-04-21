import "dotenv/config";
import { Payrail, PayrailError } from "@payrail/sdk";

// Demo agent — a "news reader" that autonomously buys headlines + articles
// from the demo merchant via Payrail. Loops forever (Ctrl-C to stop).
//
// The ENTIRE Payrail integration is the `new Payrail(...)` + `agent.fetch(...)`
// pair below. Everything else (the loop, the pretty logger) is demo dressing.

const API_KEY = process.env.PAYRAIL_KEY;
const BASE_URL = process.env.PAYRAIL_BASE_URL ?? "http://localhost:3000";
const MERCHANT_URL =
  process.env.MERCHANT_URL ?? "http://localhost:3001";
const CYCLE_MS = Number(process.env.CYCLE_MS ?? 25_000);

if (!API_KEY) {
  console.error("❌ PAYRAIL_KEY missing in .env");
  process.exit(1);
}

// This is the whole integration. One line. The agent doesn't know Solana exists.
const agent = new Payrail({ apiKey: API_KEY, baseUrl: BASE_URL });

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
  console.log(`\n${time()} 🤖 cycle #${cycle}`);
  console.log(`           total spent: ${usdc(totalSpentMicros)}`);

  // 1. Scan cheap headlines to decide what to read this cycle.
  console.log(`\n${time()} → GET /headlines        (scan)`);
  const headlinesRes = await agent.fetch(`${MERCHANT_URL}/headlines`);
  await logResult(headlinesRes, "/headlines", 5_000n);
  if (!headlinesRes.ok) return;

  const { headlines } = (await headlinesRes.json()) as {
    headlines: Headline[];
  };
  console.log(`           ${headlines.length} headlines returned`);

  // 2. Pick 1-2 articles that "look interesting" — randomised so the demo
  //    feed looks alive across cycles instead of stuck on one article.
  const picks = pickRandom(headlines, Math.random() < 0.3 ? 1 : 2);
  for (const pick of picks) {
    console.log(`\n${time()} → GET /article/${pick.id}        ("${pick.headline.slice(0, 40)}…")`);
    const articleRes = await agent.fetch(`${MERCHANT_URL}/article/${pick.id}`);
    await logResult(articleRes, "/article", 10_000n);
  }

  // 3. Occasionally splurge on the digest. ~1 in 4 cycles.
  if (Math.random() < 0.25) {
    console.log(`\n${time()} → GET /digest          (premium briefing)`);
    const digestRes = await agent.fetch(`${MERCHANT_URL}/digest`);
    await logResult(digestRes, "/digest", 15_000n);
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n${time()} ✓ cycle #${cycle} done in ${elapsed}s`);
}

async function logResult(
  res: Response,
  label: string,
  priceMicros: bigint,
) {
  if (res.ok) {
    totalSpentMicros += priceMicros;
    const sig = res.headers.get("x-payment-response");
    const sigShort = sig
      ? Buffer.from(sig, "base64")
          .toString()
          .match(/"transaction":"([^"]+)"/)
          ?.[1]
          ?.slice(0, 12) ?? "?"
      : "?";
    console.log(
      `           ← 200 OK · paid ${usdc(priceMicros)} · sig ${sigShort}…`,
    );
    return;
  }
  const bodyText = await res.text().catch(() => "");
  console.log(`           ← ${res.status} ${res.statusText} · ${bodyText.slice(0, 120)}`);
}

async function main() {
  console.log("🤖  Payrail demo agent — news reader\n");
  console.log(`   API key:   ${API_KEY!.slice(0, 8)}…${API_KEY!.slice(-4)}`);
  console.log(`   Payrail:   ${BASE_URL}`);
  console.log(`   Merchant:  ${MERCHANT_URL}`);
  console.log(`   Cadence:   cycle every ${CYCLE_MS / 1000}s`);
  console.log(`   Stop:      Ctrl-C\n`);
  console.log("─".repeat(64));

  while (!stopping) {
    try {
      await runCycle();
    } catch (err) {
      if (err instanceof PayrailError) {
        if (err.code === "over_cap") {
          console.log(
            `\n💸 budget cap reached — shutting down gracefully after ${cycle} cycles`,
          );
          process.exit(0);
        }
        console.error(
          `\n⚠ PayrailError (${err.code}${err.status ? `, status=${err.status}` : ""}): ${err.message}`,
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

// ─── helpers ────────────────────────────────────────────────────────

function time(): string {
  return new Date().toTimeString().slice(0, 8);
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
