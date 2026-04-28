/**
 * Editor chrome — tab bar, line numbers, a realistic status bar.
 * The status bar is the punchline: it shows an actual settlement metric
 * right under the code, tying the snippet to the on-chain outcome.
 */

type Line = { n: number; nodes: React.ReactNode };

const tokens = {
  kw: "text-[#f472b6]", // keyword / import / const / await
  str: "text-[#6ee7b7]", // string literals
  fn: "text-[#7dd3fc]", // function calls
  cls: "text-[#fcd34d]", // class / constructor
  com: "text-zinc-600 italic", // comments
  id: "text-zinc-200", // identifiers
  op: "text-zinc-500", // operators/punctuation
};

const lines: Line[] = [
  {
    n: 1,
    nodes: (
      <>
        <span className={tokens.kw}>import</span>
        <span className={tokens.op}> {"{"} </span>
        <span className={tokens.id}>Obscura</span>
        <span className={tokens.op}> {"}"} </span>
        <span className={tokens.kw}>from</span>{" "}
        <span className={tokens.str}>&quot;@obscura-app/sdk&quot;</span>
        <span className={tokens.op}>;</span>
      </>
    ),
  },
  { n: 2, nodes: <>&nbsp;</> },
  {
    n: 3,
    nodes: (
      <>
        <span className={tokens.kw}>const</span>{" "}
        <span className={tokens.id}>agent</span>{" "}
        <span className={tokens.op}>=</span>{" "}
        <span className={tokens.kw}>new</span>{" "}
        <span className={tokens.cls}>Obscura</span>
        <span className={tokens.op}>({"{"}</span>
      </>
    ),
  },
  {
    n: 4,
    nodes: (
      <>
        {"  "}
        <span className={tokens.id}>apiKey</span>
        <span className={tokens.op}>:</span>{" "}
        <span className={tokens.id}>process</span>
        <span className={tokens.op}>.</span>
        <span className={tokens.id}>env</span>
        <span className={tokens.op}>.</span>
        <span className={tokens.id}>OBSCURA_KEY</span>
        <span className={tokens.op}>,</span>
      </>
    ),
  },
  {
    n: 5,
    nodes: (
      <>
        <span className={tokens.op}>{"}"})</span>
        <span className={tokens.op}>;</span>
      </>
    ),
  },
  { n: 6, nodes: <>&nbsp;</> },
  {
    n: 7,
    nodes: (
      <span className={tokens.com}>
        {"// fetches + pays + retries. one call."}
      </span>
    ),
  },
  {
    n: 8,
    nodes: (
      <>
        <span className={tokens.kw}>const</span>{" "}
        <span className={tokens.id}>res</span>{" "}
        <span className={tokens.op}>=</span>{" "}
        <span className={tokens.kw}>await</span>{" "}
        <span className={tokens.id}>agent</span>
        <span className={tokens.op}>.</span>
        <span className={tokens.fn}>fetch</span>
        <span className={tokens.op}>(</span>
      </>
    ),
  },
  {
    n: 9,
    nodes: (
      <>
        {"  "}
        <span className={tokens.str}>
          &quot;https://news-api.com/v1/top&quot;
        </span>
        <span className={tokens.op}>,</span>
      </>
    ),
  },
  {
    n: 10,
    nodes: (
      <>
        <span className={tokens.op}>);</span>
      </>
    ),
  },
  { n: 11, nodes: <>&nbsp;</> },
  {
    n: 12,
    nodes: (
      <>
        <span className={tokens.id}>console</span>
        <span className={tokens.op}>.</span>
        <span className={tokens.fn}>log</span>
        <span className={tokens.op}>(</span>
        <span className={tokens.kw}>await</span>{" "}
        <span className={tokens.id}>res</span>
        <span className={tokens.op}>.</span>
        <span className={tokens.fn}>json</span>
        <span className={tokens.op}>());</span>
      </>
    ),
  },
];

export function CodeEditor() {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800 bg-[#0b0b0d] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
      {/* Title bar */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-[#0e0e11] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-700" />
          </div>
          <span className="font-mono text-[11px] text-zinc-500">
            agent-example
          </span>
        </div>
        <div className="flex items-center gap-4 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">
          <span className="hidden sm:inline">@obscura-app/sdk@0.1.0</span>
          <span className="text-zinc-700">·</span>
          <span>Node 22 · TS 5.9</span>
        </div>
      </div>

      {/* Tab strip */}
      <div className="flex items-center border-b border-zinc-800 bg-[#0b0b0d]">
        <div className="flex items-center gap-2 border-b border-emerald-400/80 bg-[#0a0a0a] px-4 py-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="font-mono text-[11px] text-zinc-200">agent.ts</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 font-mono text-[11px] text-zinc-600">
          merchant.ts
        </div>
        <div className="flex items-center gap-2 px-4 py-2 font-mono text-[11px] text-zinc-600">
          .env
        </div>
      </div>

      {/* Code body */}
      <div className="relative grid grid-cols-[52px_1fr] font-mono text-[13px] leading-[1.75]">
        <div className="border-r border-zinc-800/60 bg-[#0a0a0a] py-5 text-right">
          {lines.map((l) => (
            <div
              key={l.n}
              className="select-none pr-3 text-[11px] text-zinc-600"
            >
              {l.n}
            </div>
          ))}
        </div>
        <div className="overflow-x-auto py-5 pl-4 pr-6">
          {lines.map((l, i) => (
            <div
              key={l.n}
              className="reveal whitespace-pre text-zinc-300"
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              {l.nodes}
            </div>
          ))}
          {/* Blinking caret on the last content line */}
          <div className="mt-1 h-[1.75em]">
            <span className="blink-cursor inline-block h-[1.2em] w-[8px] translate-y-[3px] bg-emerald-400/80" />
          </div>
        </div>
      </div>

      {/* Status bar — the real punchline. Mirrors editor status-bar chrome
          but reports the on-chain outcome of the call, not linting. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-zinc-800 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent px-4 py-2.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-zinc-400">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
          <span className="text-zinc-200">settled</span>
        </span>
        <span className="text-zinc-700">/</span>
        <span>0.0080 USDC</span>
        <span className="text-zinc-700">/</span>
        <span>412 ms end-to-end</span>
        <span className="text-zinc-700">/</span>
        <span className="hidden sm:inline">sig 5k2…f8a · solana devnet</span>
        <span className="ml-auto hidden items-center gap-2 text-zinc-500 md:flex">
          <span>main</span>
          <span className="text-zinc-700">·</span>
          <span>UTF-8</span>
        </span>
      </div>
    </div>
  );
}
