import { and, desc, eq } from "drizzle-orm";
import { db, transactions, agents } from "@/lib/db";
import { authGuard } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";

// GET /api/topup/status/[paymentId]
// Returns the current state of a top-up by Dodo's payment_id. The /topup/done
// page polls this after the user returns from Dodo — the webhook credits the
// agent async, and the user sees "pending" until we flip to "confirmed".
//
// Scoped by user: you can only see payments for agents you own. 404 for
// unknown payment OR payment belonging to another user.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ paymentId: string }> },
) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;

  const { paymentId } = await ctx.params;
  if (!paymentId) return apiError("bad_request");

  const [row] = await db
    .select({
      status: transactions.status,
      amountUsdg: transactions.amountUsdg,
      amountInr: transactions.amountInr,
      solanaSig: transactions.solanaSig,
      agentId: transactions.agentId,
      agentName: agents.name,
    })
    .from(transactions)
    .innerJoin(agents, eq(transactions.agentId, agents.id))
    .where(
      and(
        eq(transactions.dodoPaymentId, paymentId),
        eq(agents.userId, user.id),
      ),
    )
    .orderBy(desc(transactions.createdAt))
    .limit(1);

  if (!row) {
    // The webhook hasn't landed yet (or never will). Return pending so the
    // client keeps polling; it'll stop after its own timeout.
    return apiOk({ state: "pending" as const });
  }

  return apiOk({
    state: row.status,
    amountUsdg: row.amountUsdg.toString(),
    amountInr: row.amountInr?.toString() ?? null,
    solanaSig: row.solanaSig,
    agentId: row.agentId,
    agentName: row.agentName,
  });
}
