import { and, desc, eq, isNull } from "drizzle-orm";
import {
  db,
  agents,
  agentApiKeys,
  transactions,
  type Transaction,
} from "@/lib/db";
import { hashAgentApiKey } from "@/lib/agent-keys";
import { env } from "@/lib/env";
import {
  DEMO_RUNS_TOPIC,
  eventBroker,
  type DemoRunEvent,
} from "@/lib/event-broker";

// World-readable by design: response only exposes publicly visible chain data.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HISTORY_LIMIT = 10;
const HEARTBEAT_INTERVAL_MS = 25_000;

export async function GET(req: Request) {
  if (!env.DEMO_AGENT_API_KEY) {
    return new Response(
      JSON.stringify({ error: "demo_disabled", message: "Demo not configured." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const demoAgentId = await resolveDemoAgentId(env.DEMO_AGENT_API_KEY);
  // Stale/unmatched key → still open the stream so live publishes work even with empty hydration.
  const history = demoAgentId ? await loadHistory(demoAgentId) : [];

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
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      // controller.enqueue can throw post-disconnect without firing abort; close to avoid leaks.
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };

      safeEnqueue(`: connected\n\n`);

      // Reverse to oldest-first so the client's prepend-on-receive lands newest-at-top.
      for (const evt of [...history].reverse()) {
        safeEnqueue(`event: demo_run\ndata: ${JSON.stringify(evt)}\n\n`);
      }

      unsubscribe = eventBroker.subscribe(DEMO_RUNS_TOPIC, (event) => {
        if (event.kind !== "demo_run") return;
        safeEnqueue(`event: demo_run\ndata: ${JSON.stringify(event)}\n\n`);
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

async function resolveDemoAgentId(apiKey: string): Promise<string | null> {
  const keyHash = hashAgentApiKey(apiKey);
  const rows = await db
    .select({ id: agents.id })
    .from(agentApiKeys)
    .innerJoin(agents, eq(agents.id, agentApiKeys.agentId))
    .where(
      and(eq(agentApiKeys.keyHash, keyHash), isNull(agentApiKeys.revokedAt)),
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

async function loadHistory(agentId: string): Promise<DemoRunEvent[]> {
  const rows: Transaction[] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.agentId, agentId), eq(transactions.kind, "spend")))
    .orderBy(desc(transactions.createdAt))
    .limit(HISTORY_LIMIT);

  // Endpoint isn't persisted; reconstruct from price tier and fall back to merchantHost.
  return rows.map((row) => ({
    kind: "demo_run" as const,
    endpoint: endpointFromAmount(row.amountUsdg) ?? row.merchantHost ?? "?",
    amountUsdg: row.amountUsdg.toString(),
    queueSignature: row.queueSignature ?? "",
    callbackSignature: row.callbackSignature ?? null,
    ipShort: "—",
    createdAt: row.createdAt.toISOString(),
  }));
}

function endpointFromAmount(micros: bigint): string | null {
  if (micros === 5_000n) return "/headlines";
  if (micros === 10_000n) return "/article/47";
  if (micros === 15_000n) return "/digest";
  return null;
}
