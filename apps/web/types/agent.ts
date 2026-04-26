// Wire shape for agents returned to the client. bigints are serialized as
// strings to survive JSON.stringify. Dates are ISO strings on the wire.
// This file is intentionally not server-only — client hooks import it too.

export type AgentStatus = "active" | "paused" | "cancelled";
export type BudgetPeriod = "monthly" | "daily";

export type AgentDTO = {
  id: string;
  name: string;
  // Solana pubkey (base58) of the agent's Umbra-side keypair. The encrypted
  // token account (ETA) lives at a PDA derived from this address + the mint.
  etaAddress: string;
  status: AgentStatus;
  createdAt: string;
  budget: {
    period: BudgetPeriod;
    capInr: string;
    capUsdg: string;
    spentUsdg: string;
  } | null;
};
