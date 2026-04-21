import { apiOk } from "@/lib/api";
import { merchantAuthGuard } from "@/lib/merchant-auth";
import { getMerchantStats } from "@/lib/merchant-queries";

// GET /api/merchants/me — current merchant + aggregate stats for the dashboard.
// Auth: Privy session JWT OR Bearer mk_... (dual-mode via merchantAuthGuard).
export async function GET(req: Request) {
  const ctx = await merchantAuthGuard(req);
  if (ctx instanceof Response) return ctx;

  const stats = await getMerchantStats(ctx.merchant.payoutWallet);
  return apiOk({
    merchant: {
      id: ctx.merchant.id,
      name: ctx.merchant.name,
      payoutWallet: ctx.merchant.payoutWallet,
      createdAt: ctx.merchant.createdAt,
    },
    stats,
  });
}
