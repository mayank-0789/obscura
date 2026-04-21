// Stage 3 regression — same e2e as Stage 2, but now imports `Payrail` from
// the packaged `@payrail/sdk` instead of inlining the remote-signer fetch
// wrapper. Behaviour must be identical.
//
//   pnpm stage2:client
//
// Env:
//   STAGE2_AGENT_API_KEY  — required; Bearer token for /api/x402/sign
//   STAGE2_PAYRAIL_URL    — Payrail backend (default http://localhost:3000)
//   STAGE1_MERCHANT_URL   — target merchant (default http://localhost:3001)
//   STAGE1_ARTICLE_ID     — article id to fetch (default 42)

import "dotenv/config";
import { Payrail, PayrailError } from "@payrail/sdk";

const PAYRAIL_URL =
  process.env.STAGE2_PAYRAIL_URL ?? "http://localhost:3000";
const MERCHANT_URL =
  process.env.STAGE1_MERCHANT_URL ?? "http://localhost:3001";
const ARTICLE_ID = process.env.STAGE1_ARTICLE_ID ?? "42";
const API_KEY = process.env.STAGE2_AGENT_API_KEY;

if (!API_KEY) {
  console.error(
    "❌ STAGE2_AGENT_API_KEY missing. Provision an agent first:\n" +
      "     pnpm stage2:provision-agent\n" +
      "   then export the printed API key:\n" +
      "     export STAGE2_AGENT_API_KEY=pk_…",
  );
  process.exit(1);
}

const AGENT_API_KEY: string = API_KEY;

async function main() {
  const url = `${MERCHANT_URL}/article/${ARTICLE_ID}`;
  console.log("🧑‍💻 Stage-3 regression — @payrail/sdk\n");
  console.log(`   Payrail:     ${PAYRAIL_URL}`);
  console.log(`   Merchant:    ${url}`);
  console.log(`   API key:     ${AGENT_API_KEY.slice(0, 8)}…\n`);

  const agent = new Payrail({
    apiKey: AGENT_API_KEY,
    baseUrl: PAYRAIL_URL,
  });

  console.log("→ agent.fetch (402 → auto-sign via @payrail/sdk → retry)…\n");
  const t0 = Date.now();
  const res = await agent.fetch(url);
  const elapsed = Date.now() - t0;

  console.log(`← ${res.status} in ${elapsed}ms`);
  const body = await res.json();
  console.log("   Body:", JSON.stringify(body, null, 2));

  const xPaymentResp = res.headers.get("x-payment-response");
  if (xPaymentResp) {
    const decoded = JSON.parse(Buffer.from(xPaymentResp, "base64").toString());
    console.log(`   Settled tx:  ${decoded.transaction}`);
    console.log(
      `   Solscan:     https://solscan.io/tx/${decoded.transaction}?cluster=devnet`,
    );
  }

  if (res.status !== 200) {
    console.error("\n❌ Non-200 response — Stage 3 is red.");
    process.exit(1);
  }
  console.log("\n✅ Stage 3 SDK regression green");
  console.log("   • @payrail/sdk packaged, ESM+CJS built, types shipped");
  console.log("   • Identical on-chain result to Stage 2 (pre-packaging)");
}

main().catch((err) => {
  if (err instanceof PayrailError) {
    console.error(
      `\n❌ PayrailError (${err.code}${err.status ? `, status=${err.status}` : ""}): ${err.message}`,
    );
    if (err.cause) console.error("   cause:", err.cause);
    process.exit(1);
  }
  console.error("\n❌ Client threw:", err);
  process.exit(1);
});
