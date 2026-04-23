import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, agents } from "@/lib/db";
import { authGuard } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";
import { env } from "@/lib/env";
import { dodo } from "@/lib/dodo/client";
import { checkLimit } from "@/lib/ratelimit";
import { getInrPerUsd } from "@/lib/fx";
import { calculateTopupBreakdown, serializeBreakdown } from "@/lib/pricing";

const CreateTopupSessionBody = z.object({
  agentId: z.string().uuid(),
  // Min ₹500 is the floor that keeps our margin positive after Dodo fee + GST.
  // Max ₹1,00,000 per single top-up for anti-fraud.
  amountInr: z.number().int().min(500).max(100_000),
});

// POST /api/topup/session — create a Dodo Payments checkout session scoped to
// a specific agent. Returns `checkoutUrl` which the client redirects to.
//
// The agent_id is passed as checkout metadata so the webhook handler can link
// the confirmed payment back to the exact agent wallet we're crediting.
export async function POST(req: Request) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;

  const body = await parseBody(req);
  if (body instanceof Response) return body;

  // Prevent checkout-session spam: each user is capped at 10 initiated top-ups
  // per hour. Refill attempts after a genuine failure are rare; this is a
  // generous ceiling against abuse.
  const allowed = await checkLimit("topup-session", user.id, 10, "1 h");
  if (!allowed) return apiError("rate_limited");

  const [agent] = await db
    .select({ id: agents.id, name: agents.name, status: agents.status })
    .from(agents)
    .where(and(eq(agents.id, body.agentId), eq(agents.userId, user.id)))
    .limit(1);
  if (!agent) return apiError("not_found");
  if (agent.status !== "active") return apiError("bad_request");

  const amountInPaise = body.amountInr * 100;

  // Lock the FX rate at intent creation. Stamped into Dodo metadata so the
  // webhook credits the exact USDG we promised here, regardless of how long
  // the user takes to complete checkout or any rate movement in between.
  const { rate } = await getInrPerUsd();
  const breakdown = calculateTopupBreakdown(BigInt(amountInPaise), rate);

  try {
    const session = await dodo.checkoutSessions.create({
      product_cart: [
        {
          product_id: env.DODO_TOPUP_PRODUCT_ID,
          quantity: 1,
          amount: amountInPaise,
        },
      ],
      return_url: `${env.NEXT_PUBLIC_APP_URL}/topup/done?agent_id=${agent.id}`,
      metadata: {
        agent_id: agent.id,
        user_id: user.id,
        amount_inr_paise: String(amountInPaise),
        rate_snapshot: rate.toString(),
      },
      // Lock down the checkout surface so the final charge cannot diverge from
      // the amount + currency we already validated server-side. The webhook
      // amount-mismatch guard is the ultimate backstop, but disabling these at
      // Dodo level means no user ever gets to the "paid then refused" state.
      feature_flags: {
        allow_discount_code: false,
        allow_currency_selection: false,
      },
    });

    if (!session.checkout_url) return apiError("server_error");
    return apiOk({
      checkoutUrl: session.checkout_url,
      sessionId: session.session_id,
      breakdown: serializeBreakdown(breakdown),
    });
  } catch (err) {
    console.error("[topup/session] dodo createSession", err);
    return apiError("server_error");
  }
}

async function parseBody(req: Request) {
  try {
    return CreateTopupSessionBody.parse(await req.json());
  } catch {
    return apiError("bad_request");
  }
}
