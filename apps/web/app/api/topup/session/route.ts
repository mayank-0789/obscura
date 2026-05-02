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
  amountInr: z.number().int().min(500).max(100_000),
  quotedRate: z.number().positive().optional(),
});

// 0.5% — wider than realistic intra-minute USD/INR moves but narrower than a stale 15-min cache.
const RATE_DRIFT_TOLERANCE = 0.005;

export async function POST(req: Request) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;

  const body = await parseBody(req);
  if (body instanceof Response) return body;

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

  const { rate, source } = await getInrPerUsd();

  // Refuse to lock the fallback rate — would over-charge by ~1.5% vs the live rate the user saw.
  if (source === "fallback") {
    return apiError(
      "rate_unavailable",
      "FX rate provider is unreachable. Please retry in a moment.",
    );
  }

  if (body.quotedRate !== undefined) {
    const drift = Math.abs(rate - body.quotedRate) / body.quotedRate;
    if (drift > RATE_DRIFT_TOLERANCE) {
      return apiError(
        "conflict",
        `Quoted rate ${body.quotedRate.toFixed(2)} drifted to ${rate.toFixed(2)}; please re-quote.`,
      );
    }
  }

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
      // Lock down checkout surface so final charge can't diverge from validated amount/currency.
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
