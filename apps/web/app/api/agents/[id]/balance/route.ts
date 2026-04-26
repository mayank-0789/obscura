import { and, eq } from "drizzle-orm";
import { db, agents } from "@/lib/db";
import { authGuard } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";
import { env } from "@/lib/env";
import { getEncryptedBalance } from "@/lib/umbra";

// GET /api/agents/[id]/balance — the agent's encrypted-balance for the
// configured stablecoin. Returns base units + decimals so the client can
// format with formatUsdg().
//
// Source: Umbra `getEncryptedBalanceQuerierFunction` over the agent's
// shared-mode encrypted account. The decrypt happens locally in this process
// using the agent's server-derived X25519 key — no Arcium MPC round-trip,
// so the call returns in ~tens of ms (single RPC `getAccountInfo` plus a
// Rescue cipher decrypt).
//
// Response semantics:
//   - Agent registered + has deposits → 200 with the actual decrypted bigint
//   - Agent registered + zero balance → 200 with amount="0"
//   - Agent not yet umbra-active (recently created mid-flight, or registration
//     never finalised) → 200 with amount="0" (querier returns null)
//   - Server / SDK error reading the balance → 503 server_error
//   - Agent not found / not yours → 404
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;

  const { id } = await ctx.params;

  const [agent] = await db
    .select({ id: agents.id, umbraStatus: agents.umbraStatus })
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, user.id)))
    .limit(1);
  if (!agent) return apiError("not_found");

  // Fast path — if the agent isn't yet umbra-active, no balance to fetch.
  // Returning zero is the correct product answer (a freshly-created agent
  // pre-first-topup has no encrypted state) and avoids an SDK round-trip.
  if (agent.umbraStatus !== "active") {
    return apiOk({ amount: "0", decimals: env.STABLECOIN_DECIMALS });
  }

  try {
    const balance = await getEncryptedBalance("agent", agent.id);
    return apiOk({
      amount: (balance ?? 0n).toString(),
      decimals: env.STABLECOIN_DECIMALS,
    });
  } catch (err) {
    console.error(`[agents/balance] umbra read failed for agent=${agent.id}:`, err);
    return apiError("server_error");
  }
}
