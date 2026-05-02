import { z } from "zod";
import { authGuard } from "@/lib/auth";
import { apiError, apiOk } from "@/lib/api";
import { getInrPerUsd } from "@/lib/fx";
import { calculateTopupBreakdown, serializeBreakdown } from "@/lib/pricing";
import { checkLimit } from "@/lib/ratelimit";

const QuoteBody = z.object({
  amountInr: z.number().int().min(500).max(100_000),
});

export async function POST(req: Request) {
  const user = await authGuard(req);
  if (user instanceof Response) return user;

  // Generous rate limit since this fires on every amount-change in the UI.
  const allowed = await checkLimit("topup-quote", user.id, 120, "1 m");
  if (!allowed) return apiError("rate_limited");

  let body: z.infer<typeof QuoteBody>;
  try {
    body = QuoteBody.parse(await req.json());
  } catch {
    return apiError("bad_request");
  }

  const { rate, source, fetchedAt } = await getInrPerUsd();
  const breakdown = calculateTopupBreakdown(
    BigInt(body.amountInr) * 100n,
    rate,
  );

  return apiOk({
    breakdown: serializeBreakdown(breakdown),
    rateSource: source,
    fetchedAt,
  });
}
