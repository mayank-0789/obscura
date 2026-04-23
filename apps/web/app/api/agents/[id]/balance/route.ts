import { and, eq } from "drizzle-orm";
import { PublicKey, getAssociatedTokenAddress } from "@payrail-app/solana";
import { db, agents } from "@/lib/db";
import { authGuard } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";
import { env } from "@/lib/env";
import { getConnection, getStablecoinMint } from "@/lib/solana";

// GET /api/agents/[id]/balance — live on-chain stablecoin balance for this
// agent's ATA. Returns base units + decimals so the client can format with
// formatUsdg().
//
// Error semantics:
//   - ATA doesn't exist on-chain (agent never topped up) → 200 with 0 balance.
//     That's the correct product answer; don't confuse the user.
//   - Any other RPC failure → 503. The client's polling will retry; surfacing
//     the distinction lets the UI show "refresh failed, retrying" vs. pretending
//     the balance is genuinely zero.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;

  const { id } = await ctx.params;

  const [agent] = await db
    .select({ publicKey: agents.publicKey })
    .from(agents)
    .where(and(eq(agents.id, id), eq(agents.userId, user.id)))
    .limit(1);
  if (!agent) return apiError("not_found");

  const mint = getStablecoinMint();
  const owner = new PublicKey(agent.publicKey);
  const ata = await getAssociatedTokenAddress(mint, owner);

  try {
    const response = await getConnection().getTokenAccountBalance(ata);
    return apiOk({
      amount: response.value.amount,
      decimals: response.value.decimals,
    });
  } catch (err) {
    if (isAtaNotFound(err)) {
      return apiOk({ amount: "0", decimals: env.STABLECOIN_DECIMALS });
    }
    console.error("[agents/balance] helius error", err);
    return apiError("server_error");
  }
}

// Helius returns a specific error when the ATA doesn't exist yet. Different
// RPC nodes phrase it differently, so match on substrings rather than exact
// message. When this check yields false positives in practice, narrow it.
function isAtaNotFound(err: unknown): boolean {
  const message =
    err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    message.includes("could not find account") ||
    message.includes("account not found") ||
    message.includes("invalid param: could not find")
  );
}
