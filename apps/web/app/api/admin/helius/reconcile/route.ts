import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db, merchants } from "@/lib/db";
import { env } from "@/lib/env";
import { reconcileMerchantPayoutAddresses } from "@/lib/helius";

// POST /api/admin/helius/reconcile — ensure every merchant.eta_address is
// registered on the shared Helius webhook. Safety net for the GET→modify→PUT
// race in registerMerchantPayoutAddress (two concurrent signups can clobber
// each other) and any other drift. Run from cron or manually via curl.
//
// Auth: shared-secret Bearer token, compared in constant time. When
// ADMIN_API_TOKEN is unset the endpoint 503s so a misconfigured deploy can't
// silently accept the first header value it sees.
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
    // Server-side log carries the full error for diagnostics. The response
    // body intentionally does NOT include err.message — Helius errors can
    // echo back the query-string api-key or other env values (see
    // fetchWebhookConfig / putWebhookConfig in lib/helius.ts), which we
    // don't want surfaced to whoever hits this endpoint.
    console.error("[admin/helius/reconcile] failed:", err);
    return NextResponse.json({ error: "reconcile_failed" }, { status: 500 });
  }
}

// Constant-time compare to avoid a timing oracle on the admin token. Node's
// `crypto.timingSafeEqual` throws on unequal-length inputs — we short-circuit
// on length mismatch but still run a dummy compare against a zero buffer so
// length differences aren't observable via response-time either.
function constantTimeTokenCheck(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    // Burn roughly the same CPU we would on a successful compare so attackers
    // can't distinguish length-mismatch from content-mismatch by latency.
    const zero = Buffer.alloc(b.length);
    timingSafeEqual(zero, b);
    return false;
  }
  return timingSafeEqual(a, b);
}
