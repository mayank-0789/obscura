import "server-only";

import { env } from "@/lib/env";
import { DEMO_RUNS_TOPIC, eventBroker } from "@/lib/event-broker";
import { solscanTxUrl } from "@/lib/solscan";

// Drives the judge-facing /demo playground. Re-implements the x402 dance
// inline (instead of calling the SDK's one-shot agent.fetch) so each
// transition can be emitted as a discrete UI step. Privacy framing is
// load-bearing here: every step name calls out what the Umbra mixer hides
// vs. what's visible — that's the whole reason judges are looking.

export type DemoEndpoint = "/headlines" | "/article/47" | "/digest";

export const DEMO_ENDPOINTS: readonly DemoEndpoint[] = [
  "/headlines",
  "/article/47",
  "/digest",
] as const;

export function isDemoEndpoint(value: unknown): value is DemoEndpoint {
  return (
    typeof value === "string" &&
    (DEMO_ENDPOINTS as readonly string[]).includes(value)
  );
}

export type DemoStep =
  | {
      phase: "calling_merchant";
      text: string;
      endpoint: DemoEndpoint;
    }
  | {
      phase: "payment_required";
      text: string;
      amountMicros: string;
      recipientShort: string;
    }
  | {
      phase: "signing";
      text: string;
      detail: string;
    }
  | {
      phase: "settled";
      text: string;
      queueSignature: string;
      callbackSignature: string | null;
      solscanUrl: string;
    }
  | {
      phase: "fetching_resource";
      text: string;
    }
  | {
      phase: "done";
      text: string;
      endpoint: DemoEndpoint;
      amountMicros: string;
      resource: unknown;
      queueSignature: string;
      callbackSignature: string | null;
      solscanUrl: string;
    }
  | {
      phase: "error";
      text: string;
      // SDK-aligned error code so the UI can style insufficient_funds /
      // over_cap / signing_failed differently from a generic failure.
      code: string;
    };

export type RunDemoSpendInput = {
  endpoint: DemoEndpoint;
  ipShort: string;
  baseUrl: string;
  onStep: (step: DemoStep) => void;
};

// Decoded shape of `paymentRequiredHeader` as emitted by the merchant SDK.
// We only read a couple of fields; loosely typed because we don't import the
// merchant SDK's PaymentRequired type here (kept the orchestrator dependency-
// free for fast cold starts on the SSE route).
type DecodedPaymentRequired = {
  accepts?: Array<{
    scheme?: string;
    network?: string;
    amount?: string;
    payTo?: string;
    asset?: string;
  }>;
};

type DecodedPaymentEnvelope = {
  queueSignature?: string;
  callbackSignature?: string | null;
};

export async function runDemoSpend(input: RunDemoSpendInput): Promise<void> {
  const { endpoint, ipShort, baseUrl, onStep } = input;

  const apiKey = env.DEMO_AGENT_API_KEY;
  const merchantUrl = env.DEMO_MERCHANT_URL;
  if (!apiKey || !merchantUrl) {
    onStep({
      phase: "error",
      text: "Demo is offline — operator has not configured DEMO_AGENT_API_KEY / DEMO_MERCHANT_URL.",
      code: "demo_disabled",
    });
    return;
  }

  const resourceUrl = `${merchantUrl.replace(/\/+$/, "")}${endpoint}`;

  // 1. Initial fetch — expect 402 from the demo merchant.
  onStep({
    phase: "calling_merchant",
    text: `Agent → GET ${endpoint}`,
    endpoint,
  });

  let initial: Response;
  try {
    initial = await fetch(resourceUrl);
  } catch (err) {
    onStep({
      phase: "error",
      text: `Couldn't reach demo merchant at ${merchantUrl}: ${describe(err)}`,
      code: "network_error",
    });
    return;
  }

  if (initial.status !== 402) {
    onStep({
      phase: "error",
      text: `Expected 402 from merchant; got ${initial.status} ${initial.statusText}`,
      code: "unexpected_status",
    });
    return;
  }

  const paymentRequiredHeader =
    initial.headers.get("payment-required") ??
    initial.headers.get("PAYMENT-REQUIRED");
  if (!paymentRequiredHeader) {
    onStep({
      phase: "error",
      text: "Merchant returned 402 without a PAYMENT-REQUIRED header.",
      code: "no_payment_required_header",
    });
    return;
  }

  const decoded = decodeBase64Json<DecodedPaymentRequired>(paymentRequiredHeader);
  const requirement = decoded?.accepts?.[0];
  if (!requirement?.amount || !requirement.payTo) {
    onStep({
      phase: "error",
      text: "Merchant's PAYMENT-REQUIRED header was malformed.",
      code: "invalid_challenge",
    });
    return;
  }

  onStep({
    phase: "payment_required",
    text: `← 402 — merchant wants ${formatMicros(requirement.amount)} USDC`,
    amountMicros: requirement.amount,
    recipientShort: shortAddr(requirement.payTo),
  });

  // 2. Ask Obscura to sign — internal HTTP hop into our own /api/x402/sign.
  //    Going via the public API URL (rather than importing the route handler)
  //    keeps auth / cap / mixer plumbing in exactly one place.
  onStep({
    phase: "signing",
    text: "Obscura signing via Umbra mixer…",
    detail:
      "Encrypted balance debit + UTXO commitment. Amount and recipient are NOT visible on-chain.",
  });

  let signRes: Response;
  try {
    signRes = await fetch(`${baseUrl.replace(/\/+$/, "")}/api/x402/sign`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ paymentRequiredHeader, resourceUrl }),
    });
  } catch (err) {
    onStep({
      phase: "error",
      text: `Obscura sign call failed: ${describe(err)}`,
      code: "network_error",
    });
    return;
  }

  if (!signRes.ok) {
    const body = (await signRes.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    onStep({
      phase: "error",
      text: body.message
        ? `${body.error ?? signRes.status}: ${body.message}`
        : `Obscura sign failed (${signRes.status})`,
      code: body.error ?? "signing_failed",
    });
    return;
  }

  const signBody = (await signRes.json().catch(() => null)) as {
    paymentSignatureHeader?: string;
  } | null;
  if (!signBody?.paymentSignatureHeader) {
    onStep({
      phase: "error",
      text: "Obscura returned no paymentSignatureHeader.",
      code: "server_error",
    });
    return;
  }

  const envelope =
    decodeBase64Json<DecodedPaymentEnvelope>(signBody.paymentSignatureHeader) ??
    {};
  const queueSignature = envelope.queueSignature ?? "";
  const callbackSignature = envelope.callbackSignature ?? null;
  // Prefer the callback signature for Solscan — that's the on-chain
  // breadcrumb proving the encrypted-state update finalised. Fall back to the
  // queue tx if the callback didn't land yet (shouldn't happen for an OK
  // sign response, but be defensive).
  const solscanSig = callbackSignature ?? queueSignature;
  const solscanUrl = solscanSig ? solscanTxUrl(solscanSig) : "";

  onStep({
    phase: "settled",
    text: `Mixer settled — queue tx ${shortSig(queueSignature)}${
      callbackSignature ? `  ·  MPC callback ${shortSig(callbackSignature)}` : ""
    }`,
    queueSignature,
    callbackSignature,
    solscanUrl,
  });

  // 3. Re-fetch the merchant resource with PAYMENT-SIGNATURE.
  onStep({
    phase: "fetching_resource",
    text: `Agent → GET ${endpoint} (with PAYMENT-SIGNATURE)`,
  });

  let final: Response;
  try {
    final = await fetch(resourceUrl, {
      headers: { "PAYMENT-SIGNATURE": signBody.paymentSignatureHeader },
    });
  } catch (err) {
    onStep({
      phase: "error",
      text: `Couldn't re-fetch merchant resource: ${describe(err)}`,
      code: "network_error",
    });
    return;
  }

  if (!final.ok) {
    onStep({
      phase: "error",
      text: `Merchant rejected payment: ${final.status} ${final.statusText}`,
      code: "merchant_reject",
    });
    return;
  }

  const resource = (await final.json().catch(() => null)) as unknown;

  onStep({
    phase: "done",
    text: `← 200  paid ${formatMicros(requirement.amount)} USDC`,
    endpoint,
    amountMicros: requirement.amount,
    resource,
    queueSignature,
    callbackSignature,
    solscanUrl,
  });

  // Fan out to the side-panel subscribers. Best-effort — never throw out of
  // the orchestrator just because publish failed.
  try {
    eventBroker.publish(DEMO_RUNS_TOPIC, {
      kind: "demo_run",
      endpoint,
      amountUsdg: requirement.amount,
      queueSignature,
      callbackSignature,
      ipShort,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[demo-orchestrator] broker publish failed:", err);
  }
}

/* ─── helpers ───────────────────────────────────────────────────── */

function decodeBase64Json<T>(b64: string): T | null {
  try {
    const json = Buffer.from(b64, "base64").toString("utf8");
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

function shortSig(sig: string | null | undefined): string {
  if (!sig) return "—";
  return `${sig.slice(0, 8)}…`;
}

function shortAddr(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export function formatMicros(micros: string | bigint): string {
  const n = typeof micros === "bigint" ? micros : BigInt(micros);
  const whole = n / 1_000_000n;
  const frac = (n % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : `${whole}`;
}
