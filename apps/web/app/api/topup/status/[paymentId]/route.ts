import { and, desc, eq } from "drizzle-orm";
import { db, transactions, agents } from "@/lib/db";
import { authGuard } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";

// Polling-only model: /topup/done polls this; the Dodo webhook (other route) does the credit.
// 404s for unknown payment OR payment belonging to another user.
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
    // Webhook hasn't landed yet — return pending so the client keeps polling.
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
