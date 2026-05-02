import { merchantAuthGuard } from "@/lib/merchant-auth";
import { eventBroker, merchantPaymentTopic } from "@/lib/event-broker";

export const dynamic = "force-dynamic";

// Pin to nodejs — the eventBroker singleton is process-pinned to globalThis;
// edge isolates would silently decouple SSE subscribers from webhook publishers.
export const runtime = "nodejs";

// SSE keepalive: 25s heartbeat to defeat proxy idle-timeouts; close + unsubscribe on disconnect.
const HEARTBEAT_INTERVAL_MS = 25_000;

const MAX_CONNECTIONS_PER_MERCHANT = 5;
const merchantConnectionCounts = new Map<string, number>();

export async function GET(req: Request) {
  const ctx = await merchantAuthGuard(req);
  if (ctx instanceof Response) return ctx;

  const merchantId = ctx.merchant.id;
  const currentCount = merchantConnectionCounts.get(merchantId) ?? 0;
  if (currentCount >= MAX_CONNECTIONS_PER_MERCHANT) {
    return new Response(
      JSON.stringify({
        error: "rate_limited",
        message: `Too many open event streams (${currentCount}). Close other dashboard tabs and retry.`,
      }),
      {
        status: 429,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  merchantConnectionCounts.set(merchantId, currentCount + 1);

  const topic = merchantPaymentTopic(ctx.merchant.etaAddress);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsubscribe: (() => void) | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;

      const close = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (unsubscribe) unsubscribe();
        const next = (merchantConnectionCounts.get(merchantId) ?? 1) - 1;
        if (next <= 0) merchantConnectionCounts.delete(merchantId);
        else merchantConnectionCounts.set(merchantId, next);
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

      safeEnqueue(`: connected\n\n`);

      unsubscribe = eventBroker.subscribe(topic, (event) => {
        safeEnqueue(`event: ${event.kind}\ndata: ${JSON.stringify(event)}\n\n`);
      });

      heartbeat = setInterval(() => {
        safeEnqueue(`: heartbeat\n\n`);
      }, HEARTBEAT_INTERVAL_MS);

      req.signal.addEventListener("abort", close, { once: true });
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
