import { NextRequest, NextResponse } from "next/server";

// First-gate for protected routes. We only check for NextAuth session-cookie
// presence here — full session verification happens inside each API route via
// lib/auth.requireAuth (which calls Auth.js's `auth()`), and on the client via
// `useSession`. Verifying JWTs at the edge would force pulling Auth.js's full
// runtime into the edge bundle; not worth it when downstream layers enforce.
// If the cookie is stale or forged, the page loads but every API call 401's
// and triggers a sign-out.
export async function proxy(req: NextRequest) {
  const authed =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");
  if (authed) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set("returnTo", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Each listed path is protected at the edge by a cookie-presence check.
  //
  // /topup is guarded so unauthenticated users can't start a checkout session.
  // /topup/done is deliberately NOT listed — it's the return target of a
  // redirect from Dodo's domain, and browsers do not always carry our session
  // cookies on that cross-site top-level navigation. Gating it at the edge
  // would bounce signed-in users off their own confirmation page. The page
  // defers to /api/topup/status/[paymentId], which enforces auth via authGuard
  // — so /topup/done rendering without a session is harmless.
  matcher: [
    "/dashboard/:path*",
    "/agents/:path*",
    "/topup",
    "/merchants/dashboard/:path*",
    "/merchants/apis/:path*",
    "/merchants/earnings/:path*",
  ],
};
