type Actor = {
  kicker: string;
  title: string;
  body: string;
  cadence: string;
  currency: string;
  Icon: React.FC;
};

const operator: Actor = {
  kicker: "01 · The operator",
  title: "You fund, once.",
  body: "Top up with UPI or card. Obscura converts it to USDC on Solana in under 30 seconds and credits your agent's wallet.",
  cadence: "One-time action",
  currency: "₹ → USDC",
  Icon: PhoneIcon,
};

const agent: Actor = {
  kicker: "02 · The runtime",
  title: "Your agent spends.",
  body: "Every API call your agent makes is paid for automatically, on-chain, per request — no wallet code, no manual approvals, no crypto knowledge.",
  cadence: "Per API call · Automatic",
  currency: "~0.008 USDC / call",
  Icon: RobotIcon,
};

const merchant: Actor = {
  kicker: "03 · The seller",
  title: "API providers get paid.",
  body: "Merchants plug in one middleware line. USDC lands in their payout wallet on every request — or they cash out to a bank via Dodo.",
  cadence: "Per request · Settles on-chain",
  currency: "USDC → INR (v2)",
  Icon: StorefrontIcon,
};

const actors: Actor[] = [operator, agent, merchant];

export function FlowDiagram() {
  return (
    <section
      aria-label="How Obscura works"
      className="border-b border-zinc-800/60 bg-[#0a0a0a]"
    >
      <div className="mx-auto max-w-[1400px] px-6 pb-28 pt-28 lg:px-10">
        <div className="mb-16 max-w-2xl">
          <p className="rule-with-pip font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-400">
            <span>Section II — How it works</span>
          </p>
          <h2 className="mt-8 font-display text-balance text-[44px] font-light leading-[1.02] tracking-[-0.02em] text-zinc-50 md:text-[60px]">
            Fund once. Spend per call.{" "}
            <span className="italic text-emerald-400/90">
              Settle on Solana.
            </span>
          </h2>
          <p className="mt-6 max-w-xl text-[15px] leading-[1.7] text-zinc-400">
            Three parties, one rail. You put rupees in at the top; agents and
            API providers move stablecoins at the bottom. Every step is
            auditable.
          </p>
        </div>

        <div className="hidden md:grid md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch md:gap-0">
          <ActorCard actor={operator} index={0} />
          <Connector label="₹500  →  $6.00 USDC" />
          <ActorCard actor={agent} index={1} />
          <Connector label="0.008 USDC / call" />
          <ActorCard actor={merchant} index={2} />
        </div>

        <div className="space-y-4 md:hidden">
          {actors.map((a, i) => (
            <div key={a.title}>
              <ActorCard actor={a} index={i} />
              {i < actors.length - 1 && (
                <div className="my-3 flex items-center gap-3 px-6">
                  <span className="h-px flex-1 bg-zinc-800" />
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-zinc-600">
                    {i === 0 ? "₹500 → $6.00 USDC" : "0.008 USDC / call"}
                  </span>
                  <span className="h-px flex-1 bg-zinc-800" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ActorCard({ actor, index }: { actor: Actor; index: number }) {
  const { Icon } = actor;
  return (
    <article
      className="reveal flex h-full flex-col border border-zinc-800 bg-[#0c0c0e] p-7 md:p-8"
      style={{ animationDelay: `${index * 0.12 + 0.05}s` }}
    >
      <div className="flex items-start justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-emerald-400">
          {actor.kicker}
        </p>
        <div className="text-zinc-300">
          <Icon />
        </div>
      </div>

      <h3 className="mt-8 font-display text-[28px] font-light leading-[1.15] tracking-tight text-zinc-50 md:text-[30px]">
        {actor.title}
      </h3>

      <p className="mt-4 text-[14.5px] leading-[1.65] text-zinc-400">
        {actor.body}
      </p>

      <div className="mt-auto space-y-2.5 pt-10">
        <Meta label="When" value={actor.cadence} />
        <Meta label="Moves" value={actor.currency} />
      </div>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-4 border-t border-zinc-800/80 pt-2.5">
      <span className="w-12 shrink-0 font-mono text-[9.5px] uppercase tracking-[0.22em] text-zinc-600">
        {label}
      </span>
      <span className="font-mono text-[11.5px] text-zinc-300">{value}</span>
    </div>
  );
}

function Connector({ label }: { label: string }) {
  return (
    <div className="flex w-16 flex-col items-center justify-center px-2 md:w-24 md:px-4">
      <div className="relative flex w-full items-center">
        <span className="h-px flex-1 bg-zinc-800" />
        <svg
          aria-hidden="true"
          viewBox="0 0 14 14"
          className="ml-[-1px] h-3 w-3 text-zinc-600"
        >
          <path
            d="M2 7 L11 7 M7 3 L11 7 L7 11"
            stroke="currentColor"
            strokeWidth="1.4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="mt-3 text-center font-mono text-[9.5px] uppercase leading-[1.35] tracking-[0.2em] text-zinc-600">
        {label}
      </span>
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden="true" className="h-14 w-14">
      <rect x="23" y="6" width="34" height="68" rx="6" stroke="currentColor" strokeWidth="1.4" />
      <line x1="34" y1="12" x2="46" y2="12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="27" y="18" width="26" height="48" rx="1" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      <line x1="34" y1="70" x2="46" y2="70" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.5" />
      <text
        x="40"
        y="50"
        textAnchor="middle"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="22"
        fontWeight="500"
        fill="#34d399"
      >
        ₹
      </text>
      <circle cx="49" cy="23" r="1.2" fill="#34d399" />
    </svg>
  );
}

function RobotIcon() {
  return (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden="true" className="h-14 w-14">
      <line x1="40" y1="4" x2="40" y2="14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="40" cy="4" r="2" fill="#34d399" />
      <rect x="18" y="14" width="44" height="38" rx="6" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="30" cy="30" r="3.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="50" cy="30" r="3.5" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="30" cy="30" r="1.3" fill="#34d399" />
      <circle cx="50" cy="30" r="1.3" fill="#34d399" />
      <rect x="28" y="40" width="24" height="3" rx="1" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <line x1="30" y1="41.5" x2="38" y2="41.5" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="34" y1="52" x2="34" y2="58" stroke="currentColor" strokeWidth="1.4" />
      <line x1="46" y1="52" x2="46" y2="58" stroke="currentColor" strokeWidth="1.4" />
      <path d="M16 72 L22 58 L58 58 L64 72" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <line x1="18" y1="26" x2="14" y2="26" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="62" y1="26" x2="66" y2="26" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="18" y1="38" x2="14" y2="38" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="62" y1="38" x2="66" y2="38" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function StorefrontIcon() {
  return (
    <svg viewBox="0 0 80 80" fill="none" aria-hidden="true" className="h-14 w-14">
      <path d="M8 22 L72 22 L64 32 L16 32 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <g stroke="currentColor" strokeWidth="1" opacity="0.35">
        <line x1="20" y1="22" x2="18" y2="32" />
        <line x1="32" y1="22" x2="30" y2="32" />
        <line x1="44" y1="22" x2="42" y2="32" />
        <line x1="56" y1="22" x2="54" y2="32" />
      </g>
      <rect x="14" y="32" width="52" height="38" stroke="currentColor" strokeWidth="1.4" />
      <rect x="34" y="48" width="12" height="22" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="43" cy="59" r="0.8" fill="currentColor" opacity="0.7" />
      <rect x="20" y="40" width="10" height="8" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <rect x="50" y="40" width="10" height="8" stroke="currentColor" strokeWidth="1" opacity="0.6" />
      <text
        x="40"
        y="44"
        textAnchor="middle"
        fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        fontSize="9"
        fontWeight="600"
        fill="#34d399"
      >
        API
      </text>
      <line x1="8" y1="72" x2="72" y2="72" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}
