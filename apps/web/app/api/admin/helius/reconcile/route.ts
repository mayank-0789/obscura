import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db, merchants } from "@/lib/db";
import { env } from "@/lib/env";
import { reconcileMerchantPayoutAddresses } from "@/lib/helius";

export async function POST(req: Request) {
  if (!env.ADMIN_API_TOKEN) {
    return NextResponse.json(
      { error: "admin_disabled", message: "ADMIN_API_TOKEN not configured" },
      { status: 503 },
    );
  }

  const token = req.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "")
    .trim();
  if (!token || !constantTimeTokenCheck(token, env.ADMIN_API_TOKEN)) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }

  const rows = await db
    .select({ etaAddress: merchants.etaAddress })
    .from(merchants);
  const wallets = rows.map((r) => r.etaAddress);

  try {
    const result = await reconcileMerchantPayoutAddresses(wallets);
    if (!result.ok) {
      return NextResponse.json(
        { error: "helius_not_configured" },
        { status: 503 },
      );
    }
    return NextResponse.json({
      ok: true,
      heliusCountBefore: result.heliusCount,
      dbCount: result.dbCount,
      addressesAdded: result.addressesAdded,
      addressesAlreadyPresent: result.addressesAlreadyPresent,
    });
  } catch (err) {
    // Don't include err.message in the response — Helius echoes the api-key in error strings.
    console.error("[admin/helius/reconcile] failed:", err);
    return NextResponse.json({ error: "reconcile_failed" }, { status: 500 });
  }
}

// Constant-time compare; on length mismatch, burn a dummy compare so latency
// doesn't reveal the expected length.
function constantTimeTokenCheck(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    const zero = Buffer.alloc(b.length);
    timingSafeEqual(zero, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
