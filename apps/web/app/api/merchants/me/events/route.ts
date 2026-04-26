import { merchantAuthGuard } from "@/lib/merchant-auth";
import { eventBroker, merchantPaymentTopic } from "@/lib/event-broker";

// GET /api/merchants/me/events — Server-Sent Events stream of payment events
// for the authenticated merchant. Use the browser's `EventSource` to consume.
//
// Event types emitted:
//   - event: `payment`  — a new confirmed spend landed in this merchant's
//                         payout wallet (see MerchantPaymentEvent shape)
//   - `:` comment lines — heartbeats every 25s to defeat proxy idle-timeouts
//
// Client disconnect (req.signal aborts) releases the broker subscription and
// closes the stream.

// Tell Next.js not to cache this at the framework level. SSE streams are
// long-lived and must not be buffered by any intermediary. `dynamic` also
// prevents the edge runtime from converting this into a static response.
export const dynamic = "force-dynamic";

// Must run on the Node.js runtime (NOT edge). The `eventBroker` singleton is
// pinned to globalThis inside a single Node process, and the Helius webhook
// handler writes to it from that same process. Edge functions execute in a
// separate V8 isolate pool, which would silently decouple SSE subscribers
// from webhook publishers — the SSE stream would stay open but receive
// zero events. Leave `nodejs` even if a future Next.js release suggests
// edge as default.
export const runtime = "nodejs";

const HEARTBEAT_INTERVAL_MS = 25_000;

export async function GET(req: Request) {
  const ctx = await merchantAuthGuard(req);
  if (ctx instanceof Response) return ctx;

  const topic = merchantPaymentTopic(ctx.merchant.etaAddress);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // enqueue throws if the controller is already closed (e.g. race
          // with the abort handler). Swallow silently — cleanup will run.
          closed = true;
        }
      };

      // Initial frame announces the connection is open and flushes any
      // buffering proxies. EventSource ignores lines beginning with `:`.
      safeEnqueue(`: connected\n\n`);

      const unsubscribe = eventBroker.subscribe(topic, (event) => {
        safeEnqueue(`event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`);
      });

      const heartbeat = setInterval(() => {
        safeEnqueue(`: heartbeat\n\n`);
      }, HEARTBEAT_INTERVAL_MS);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed — safe to ignore.
        }
      };

      // Browser closing the tab / navigating away triggers req.signal abort.
      req.signal.addEventListener("abort", close, { once: true });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Hint to reverse proxies (nginx) to disable response buffering for
      // this connection — otherwise they may batch our frames.
      "X-Accel-Buffering": "no",
    },
  });
}
