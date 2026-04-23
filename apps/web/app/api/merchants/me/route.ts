import { ensureAta, PublicKey } from "@payrail/solana";
import { apiOk } from "@/lib/api";
import { merchantAuthGuard } from "@/lib/merchant-auth";
import { getMerchantStats } from "@/lib/merchant-queries";
import { getConnection, getStablecoinMint, getTreasury } from "@/lib/solana";

// GET /api/merchants/me — current merchant + aggregate stats for the dashboard.
// Auth: Privy session JWT OR Bearer mk_... (dual-mode via merchantAuthGuard).
export async function GET(req: Request) {
  const ctx = await merchantAuthGuard(req);
  if (ctx instanceof Response) return ctx;

  // Self-heal a missing payout-wallet ATA. `provisionMerchant` opens the ATA at
  // signup, but that step is best-effort: a transient Helius/treasury hiccup
  // leaves the merchant with a wallet but no token account, and every inbound
  // x402 payment then hard-fails with "merchant must initialise their payout
  // wallet." `ensureAta` is idempotent (pre-checks with getAccountInfo, and
  // uses the Idempotent SPL instruction), so calling it on every dashboard
  // load is safe — when the ATA exists it short-circuits without a tx.
  //
  // Fire-and-forget so the dashboard response isn't blocked on RPC. The
  // polling client hits this endpoint every ~10s; the ATA will exist by the
  // next poll in the rare case it needed creation.
  void ensureAta({
    connection: getConnection(),
    payer: getTreasury(),
    owner: new PublicKey(ctx.merchant.payoutWallet),
    mint: getStablecoinMint(),
  }).catch((err) => {
    console.error(
      `[merchants/me] ATA self-heal failed for ${ctx.merchant.payoutWallet}:`,
      err,
    );
  });

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
