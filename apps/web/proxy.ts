import { NextRequest, NextResponse } from "next/server";

// First-gate for protected routes. We only check for Privy cookie presence here —
// full JWT verification happens inside each API route (via lib/auth.requireAuth)
// and in the client hooks. Verifying JWTs at the edge would require shipping the
// Privy server SDK into the edge runtime, which isn't worth the cost when the
// downstream layers already enforce auth. If the cookie is stale or forged, the
// page will load but every API call it makes will 401 and trigger a sign-out.
export async function proxy(req: NextRequest) {
  const authed =
    req.cookies.has("privy-token") || req.cookies.has("privy-id-token");
  if (authed) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set("returnTo", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/agents/:path*",
    "/topup/:path*",
    "/merchants/dashboard/:path*",
    "/merchants/apis/:path*",
    "/merchants/earnings/:path*",
  ],
};
