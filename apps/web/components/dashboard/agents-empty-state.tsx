export function AgentsEmptyState() {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-10 text-center">
      <h2 className="text-xl font-semibold tracking-tight">
        You don&apos;t have any agents yet
      </h2>
      <p className="mt-3 text-sm text-zinc-400">
        Create an agent to get a spending wallet funded via UPI. Agents
        autonomously pay for APIs on Solana.
      </p>
      <button
        disabled
        className="mt-8 inline-flex cursor-not-allowed items-center gap-2 rounded-md bg-emerald-400/50 px-5 py-2.5 text-sm font-semibold text-black/70"
        title="Agent creation ships on Day 4"
      >
        Create your first agent
        <span aria-hidden>→</span>
      </button>
      <p className="mt-3 text-xs text-zinc-600">
        Agent creation ships on Day 4.
      </p>
    </section>
  );
}
