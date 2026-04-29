import { z } from "zod";
import { env } from "@/lib/env";
import { checkLimit } from "@/lib/ratelimit";
import {
  isDemoEndpoint,
  runDemoSpend,
  type DemoStep,
} from "@/lib/demo-orchestrator";

// POST /api/demo/run — judge-facing live demo. Streams the x402 dance as
// Server-Sent Events so the /demo page can render each step in real time.
//
// Auth: none. Rate-limited per IP to prevent any one client from draining the
// demo agent's encrypted balance. The agent's monthly cap is the hard ceiling.
//
// 503 responses (instead of streaming) when the demo isn't configured —
// before any caller hits the orchestrator. Lets the page paint a clear
// "demo offline" state instead of a half-stream that errors mid-flight.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  endpoint: z.string(),
});

// ~10 demo runs per IP per hour. Tuned so a curious judge can try all three
// endpoints + a couple of repeats without hitting the wall, while a single
// scraper can't drain the agent's monthly cap (₹500K = thousands of runs).
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

  // Rate-limit by source IP. Falls back to a single shared bucket when the
  // platform doesn't expose forwarding headers (local dev) — checkLimit also
  // short-circuits to "allow" when Upstash isn't configured, so dev still
  // works.
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

  // Derive the canonical app URL from the request itself rather than env.
  // This makes the demo work on any deployment (preview, prod, custom
  // domain) without re-pinning NEXT_PUBLIC_APP_URL — the orchestrator hits
  // /api/x402/sign on the same host that's serving this stream.
  const baseUrl = canonicalBaseUrl(req);
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

      // enqueue can throw when the underlying connection has gone away
      // without firing req.signal.abort. Fold into a full close so the
      // heartbeat doesn't leak.
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

      // Heartbeat keeps proxies from idle-killing the connection during the
      // ~10–25s mixer prove. EventSource ignores `:` lines.
      heartbeat = setInterval(() => {
        safeEnqueue(`: heartbeat\n\n`);
      }, 10_000);

      // Initial frame so the client can show "connected" before the first
      // orchestrator step lands.
      safeEnqueue(`: connected\n\n`);

      // If the client disconnects mid-prove, the orchestrator keeps running
      // server-side (the on-chain debit is already in flight by then; we
      // can't cancel it). We just stop emitting — the recent broker still
      // gets the final publish so other tabs see the run complete.
      req.signal.addEventListener("abort", close, { once: true });

      try {
        await runDemoSpend({
          endpoint,
          ipShort,
          baseUrl,
          onStep: send,
        });
      } catch (err) {
        // runDemoSpend is meant to convert all internal failures into an
        // `error` step — but if something escapes, surface it rather than
        // hanging the stream.
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

/* ─── helpers ───────────────────────────────────────────────────── */

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

// Returns just the last octet (or first IPv6 group) so the side panel can
// say "IP …42" without revealing the full address. Never logged or stored.
function redactIp(ip: string): string {
  if (ip.includes(":")) return ip.split(":")[0] ?? "ipv6";
  const parts = ip.split(".");
  if (parts.length === 4) return parts[3] ?? "";
  return ip.slice(-4);
}

function canonicalBaseUrl(req: Request): string {
  const url = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}
