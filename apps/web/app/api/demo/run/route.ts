import { createHash } from "node:crypto";
import { z } from "zod";
import { env } from "@/lib/env";
import { checkLimit } from "@/lib/ratelimit";
import {
  isDemoEndpoint,
  runDemoSpend,
  type DemoStep,
} from "@/lib/demo-orchestrator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  endpoint: z.string(),
});

// Per-IP rate limit so a scraper can't drain the demo agent's monthly cap.
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = "1 h" as const;

export async function POST(req: Request) {
  if (!env.DEMO_AGENT_API_KEY || !env.DEMO_MERCHANT_URL) {
    return jsonError(503, "demo_disabled", "Demo not configured on this host.");
  }

  let parsed: z.infer<typeof Body>;
  try {
    parsed = Body.parse(await req.json());
  } catch {
    return jsonError(400, "bad_request", "Body must be { endpoint: string }.");
  }
  if (!isDemoEndpoint(parsed.endpoint)) {
    return jsonError(
      400,
      "bad_request",
      `endpoint must be one of /headlines, /article/47, /digest`,
    );
  }
  const endpoint = parsed.endpoint;

  const clientIp = extractClientIp(req);
  const ok = await checkLimit(
    "demo-run",
    clientIp,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW,
  );
  if (!ok) {
    return jsonError(
      429,
      "rate_limited",
      `Try again later — limit is ${RATE_LIMIT_MAX} demo runs per IP per hour.`,
    );
  }

  const baseUrl = canonicalBaseUrl();
  const ipShort = redactIp(clientIp);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };

      const send = (step: DemoStep) => {
        safeEnqueue(`event: ${step.phase}\ndata: ${JSON.stringify(step)}\n\n`);
      };

      heartbeat = setInterval(() => {
        safeEnqueue(`: heartbeat\n\n`);
      }, 10_000);

      safeEnqueue(`: connected\n\n`);

      req.signal.addEventListener("abort", close, { once: true });

      try {
        await runDemoSpend({
          endpoint,
          ipShort,
          baseUrl,
          onStep: send,
        });
      } catch (err) {
        console.error("[/api/demo/run] orchestrator threw:", err);
        send({
          phase: "error",
          text: "Internal error — see server logs.",
          code: "server_error",
        });
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function extractClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "0.0.0.0";
}

// Hash + truncate to 4 hex chars for "IP …a04" display; raw IP is never logged or shown.
const REDACT_SALT = "obscura-demo-v1";
function redactIp(ip: string): string {
  const digest = createHash("sha256").update(`${REDACT_SALT}|${ip}`).digest("hex");
  return digest.slice(-4);
}

function canonicalBaseUrl(): string {
  // Fixed to env: trusting X-Forwarded-Host could let a caller redirect
  // orchestrator fetches (which carry DEMO_AGENT_API_KEY) to an attacker host.
  return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
}
