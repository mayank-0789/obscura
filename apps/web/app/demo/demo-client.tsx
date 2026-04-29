"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Three button choices match the demo merchant's price tiers exactly. Keep
// them as literals here too — duplicating with the server-side
// DEMO_ENDPOINTS is fine; this is the canonical list judges actually see.
type DemoEndpoint = "/headlines" | "/article/47" | "/digest";

type Button = {
  endpoint: DemoEndpoint;
  label: string;
  price: string;
  blurb: string;
};

const BUTTONS: Button[] = [
  {
    endpoint: "/headlines",
    label: "Buy headlines",
    price: "$0.005",
    blurb: "List of 8 article headlines.",
  },
  {
    endpoint: "/article/47",
    label: "Read article",
    price: "$0.010",
    blurb: "Full body of one article.",
  },
  {
    endpoint: "/digest",
    label: "Premium digest",
    price: "$0.015",
    blurb: "Editor-curated cross-article briefing.",
  },
];

type LogEntry = {
  ts: string;
  phase: string;
  text: string;
  detail?: string | null;
  solscanUrl?: string | null;
};

type RecentRun = {
  endpoint: string;
  amountUsdg: string;
  queueSignature: string;
  callbackSignature: string | null;
  ipShort: string;
  createdAt: string;
};

export function DemoClient({ configured }: { configured: boolean }) {
  const [running, setRunning] = useState<DemoEndpoint | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const [recent, setRecent] = useState<RecentRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Side panel — long-lived SSE stream of all recent runs. Only mounts when
  // the demo is configured server-side; otherwise the route returns 503 and
  // the panel would just spam errors.
  useEffect(() => {
    if (!configured) return;
    const controller = new AbortController();
    void streamRecent(controller.signal, (run) => {
      setRecent((prev) => [run, ...prev.filter(notSameRun(run))].slice(0, 20));
    });
    return () => controller.abort();
  }, [configured]);

  const onClick = useCallback(
    async (endpoint: DemoEndpoint) => {
      if (running) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setRunning(endpoint);
      setLog([]);
      setResult(null);
      setError(null);

      try {
        await streamRun(endpoint, controller.signal, (step) => {
          if (step.phase === "done") {
            setResult(step.resource);
          }
          if (step.phase === "error") {
            setError(step.text);
          }
          setLog((prev) => [
            ...prev,
            {
              ts: nowHHMMSS(),
              phase: step.phase,
              text: step.text,
              detail: step.detail ?? null,
              solscanUrl: step.solscanUrl ?? null,
            },
          ]);
        });
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message ?? "Stream interrupted");
      } finally {
        setRunning(null);
      }
    },
    [running],
  );

  if (!configured) {
    return (
      <div className="rounded-lg border border-amber-400/30 bg-amber-400/5 p-6 text-amber-200">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em]">
          Demo offline
        </p>
        <p className="mt-2 text-sm leading-relaxed text-amber-100/80">
          The operator hasn&apos;t configured DEMO_AGENT_API_KEY +
          DEMO_MERCHANT_URL on this deployment yet. Wire those env vars in
          Vercel and redeploy to enable the live demo.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {BUTTONS.map((btn) => (
            <button
              key={btn.endpoint}
              type="button"
              disabled={running !== null}
              onClick={() => onClick(btn.endpoint)}
              className={[
                "group flex flex-col items-start gap-2 rounded-lg border bg-[#0d0d0d] p-5 text-left transition",
                running === btn.endpoint
                  ? "border-emerald-400/60 ring-1 ring-emerald-400/40"
                  : "border-zinc-800/80 hover:border-emerald-400/40",
                running !== null && running !== btn.endpoint
                  ? "opacity-40"
                  : "",
                running === null ? "cursor-pointer" : "cursor-default",
              ].join(" ")}
            >
              <span className="flex w-full items-center justify-between">
                <span className="font-display text-[17px] tracking-[-0.01em] text-zinc-100">
                  {btn.label}
                </span>
                <span className="font-mono text-[11px] text-emerald-300/90">
                  {btn.price}
                </span>
              </span>
              <span className="text-[13px] leading-snug text-zinc-500">
                {btn.blurb}
              </span>
              <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">
                GET {btn.endpoint}
              </span>
            </button>
          ))}
        </div>

        <LogConsole
          log={log}
          running={running}
          error={error}
          result={result}
        />
      </div>

      <SidePanel recent={recent} />
    </div>
  );
}

function LogConsole({
  log,
  running,
  error,
  result,
}: {
  log: LogEntry[];
  running: DemoEndpoint | null;
  error: string | null;
  result: unknown;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [log.length]);

  return (
    <div className="rounded-lg border border-zinc-800/80 bg-[#0d0d0d]">
      <div className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          <span
            className={[
              "h-1.5 w-1.5 rounded-full",
              running
                ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]"
                : "bg-zinc-600",
            ].join(" ")}
          />
          <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-400">
            {running ? `Running ${running}` : "Live log"}
          </span>
        </div>
        {log.length > 0 && (
          <span className="font-mono text-[10px] text-zinc-600">
            {log.length} step{log.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div
        ref={scrollRef}
        className="max-h-[420px] min-h-[280px] overflow-y-auto px-4 py-4 font-mono text-[12.5px] leading-relaxed"
      >
        {log.length === 0 && !running && (
          <p className="text-zinc-600">
            Click a button above to trigger a real x402 spend. Each step of
            the Umbra mixer dance will appear here.
          </p>
        )}
        {log.map((entry, i) => (
          <LogLine key={i} entry={entry} />
        ))}
        {running && log.length > 0 && log[log.length - 1]?.phase !== "done" && log[log.length - 1]?.phase !== "error" && (
          <p className="mt-2 text-zinc-500">
            <span className="inline-block h-3 w-1.5 animate-pulse bg-emerald-400/60 align-middle" />
            <span className="ml-2">working…</span>
          </p>
        )}
        {error && (
          <p className="mt-3 rounded border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-rose-200">
            {error}
          </p>
        )}
        {result !== null && (
          <pre className="mt-4 overflow-x-auto rounded border border-zinc-800/80 bg-[#080808] p-3 text-[11.5px] leading-relaxed text-zinc-300">
{JSON.stringify(result, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function LogLine({ entry }: { entry: LogEntry }) {
  const accent = phaseAccent(entry.phase);
  return (
    <div className="flex gap-3">
      <span className="shrink-0 text-zinc-600">{entry.ts}</span>
      <div className="min-w-0 flex-1">
        <span className={accent}>{entry.text}</span>
        {entry.detail && (
          <p className="mt-0.5 pl-0 text-[11.5px] text-zinc-500">{entry.detail}</p>
        )}
        {entry.solscanUrl && (
          <p className="mt-0.5">
            <a
              href={entry.solscanUrl}
              target="_blank"
              rel="noreferrer"
              className="text-emerald-300/90 underline-offset-2 hover:underline"
            >
              View on Solscan ↗
            </a>
          </p>
        )}
      </div>
    </div>
  );
}

function phaseAccent(phase: string): string {
  if (phase === "done") return "text-emerald-300";
  if (phase === "settled") return "text-emerald-300/90";
  if (phase === "error") return "text-rose-300";
  if (phase === "signing") return "text-amber-200/90";
  if (phase === "payment_required") return "text-zinc-300";
  return "text-zinc-400";
}

function SidePanel({ recent }: { recent: RecentRun[] }) {
  return (
    <aside className="rounded-lg border border-zinc-800/80 bg-[#0d0d0d]">
      <div className="border-b border-zinc-800/80 px-4 py-2.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-zinc-400">
          Other judges&apos; runs
        </p>
      </div>
      <div className="max-h-[640px] overflow-y-auto px-4 py-4">
        {recent.length === 0 ? (
          <p className="font-mono text-[11.5px] leading-relaxed text-zinc-600">
            Nothing yet. Be the first to try it.
          </p>
        ) : (
          <ul className="space-y-3">
            {recent.map((run) => (
              <li key={runKey(run)} className="border-l border-zinc-800 pl-3">
                <div className="flex items-baseline justify-between gap-3 font-mono text-[11px] text-zinc-500">
                  <span>{formatTime(run.createdAt)}</span>
                  <span className="text-emerald-300/80">
                    ${formatMicros(run.amountUsdg)}
                  </span>
                </div>
                <div className="mt-1 font-mono text-[12.5px] text-zinc-300">
                  {run.endpoint}
                </div>
                <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-zinc-600">
                  <span>{run.ipShort && run.ipShort !== "—" ? `IP …${run.ipShort}` : "from history"}</span>
                  {run.queueSignature && (
                    <a
                      href={solscanUrl(run.callbackSignature ?? run.queueSignature)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400/70 hover:text-emerald-300"
                    >
                      tx ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

/* ─── streaming helpers ─────────────────────────────────────────── */

type AnyStep = {
  phase: string;
  text: string;
  detail?: string;
  solscanUrl?: string;
  resource?: unknown;
};

async function streamRun(
  endpoint: DemoEndpoint,
  signal: AbortSignal,
  onStep: (step: AnyStep) => void,
): Promise<void> {
  const res = await fetch("/api/demo/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
    signal,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Demo run failed: ${res.status}`);
  }
  if (!res.body) throw new Error("no response body");
  await readSse(res.body, signal, (event, data) => {
    if (event === "demo_run") return; // wrong stream
    try {
      const step = JSON.parse(data) as AnyStep;
      onStep(step);
    } catch {
      // ignore malformed frames
    }
  });
}

async function streamRecent(
  signal: AbortSignal,
  onRun: (run: RecentRun) => void,
): Promise<void> {
  // Reconnect loop. If the server closes the SSE (proxy timeout, deploy,
  // etc.) wait briefly and reopen so the side panel keeps tracking new
  // runs without a page reload. On a permanent 4xx (eg. 503 demo-disabled
  // mid-session, 404 if the route is removed) we exit instead of busy-
  // hammering — those won't recover without a page reload anyway.
  while (!signal.aborted) {
    try {
      const res = await fetch("/api/demo/recent", { signal });
      if (res.status >= 400 && res.status < 500) return;
      if (!res.ok || !res.body) {
        await sleep(2_000);
        continue;
      }
      await readSse(res.body, signal, (event, data) => {
        if (event !== "demo_run") return;
        try {
          onRun(JSON.parse(data) as RecentRun);
        } catch {
          // ignore
        }
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      await sleep(2_000);
    }
  }
}

async function readSse(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  onEvent: (event: string, data: string) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  // Default event name per SSE spec when no `event:` line appears.
  let currentEvent = "message";
  let currentData: string[] = [];
  const flush = () => {
    if (currentData.length === 0) {
      currentEvent = "message";
      return;
    }
    onEvent(currentEvent, currentData.join("\n"));
    currentEvent = "message";
    currentData = [];
  };
  while (!signal.aborted) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newlineIdx: number;
    while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newlineIdx).replace(/\r$/, "");
      buffer = buffer.slice(newlineIdx + 1);
      if (line === "") {
        flush();
        continue;
      }
      if (line.startsWith(":")) continue; // comment / heartbeat
      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        currentData.push(line.slice(5).replace(/^ /, ""));
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/* ─── formatters ────────────────────────────────────────────────── */

function nowHHMMSS(): string {
  return new Date().toTimeString().slice(0, 8);
}

function formatTime(iso: string): string {
  return new Date(iso).toTimeString().slice(0, 5);
}

function formatMicros(micros: string): string {
  try {
    const n = BigInt(micros);
    const whole = n / 1_000_000n;
    const frac = (n % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : `${whole}`;
  } catch {
    return micros;
  }
}

function solscanUrl(sig: string): string {
  // Client-side mirror of lib/solscan.ts (we can't import the server-only
  // module here). Detect cluster from public env injected at build time.
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER ?? "devnet";
  const base = `https://solscan.io/tx/${sig}`;
  return cluster === "devnet" ? `${base}?cluster=devnet` : base;
}

function runKey(run: RecentRun): string {
  return run.queueSignature || `${run.createdAt}:${run.endpoint}`;
}

function notSameRun(target: RecentRun): (other: RecentRun) => boolean {
  const key = runKey(target);
  return (other) => runKey(other) !== key;
}
