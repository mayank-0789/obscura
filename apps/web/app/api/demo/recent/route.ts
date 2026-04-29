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

// GET /api/demo/recent — SSE stream of recent demo runs for the side panel.
//
// Hydration: emits one `demo_run` event per existing spend transaction for
// the configured demo agent (newest 10), then keeps the connection open and
// fans out broker publishes from /api/demo/run as they happen.
//
// No auth — this is intentionally world-readable. The returned shape only
// reveals: endpoint, amount, on-chain queue/callback signatures (all visible
// on Solscan anyway), and a 1-octet-truncated IP that the orchestrator
// already redacted before publishing.

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
  // demoAgentId is null when the configured key doesn't match any agent (e.g.
  // operator pasted a stale key). The stream still opens — empty history,
  // and any successful run will still be published to the broker so live
  // updates work even if hydration is empty.
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

      // enqueue can throw if the underlying connection has gone away without
      // firing req.signal.abort (e.g. client process killed). Fold that into
      // a full close so we don't leak a broker subscription + heartbeat.
      const safeEnqueue = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          close();
        }
      };

      safeEnqueue(`: connected\n\n`);

      // Hydration — emit oldest-first so the client (which prepends each
      // run into a list) ends up with newest-at-top after replay. The DB
      // query already returned newest-first; reversing here is one O(n)
      // copy on a list of 10.
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

  // Best-effort reconstruction. We don't keep the original endpoint string,
  // so derive it from `merchantHost` + the price tier (5000/10000/15000 →
  // /headlines /article /digest). Falls back to the merchant host alone
  // when the amount doesn't match any tier.
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
