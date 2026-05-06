import { NextRequest, NextResponse } from "next/server";

// Cookie-presence check only. Full JWT verification happens in each API route
// via lib/auth.requireAuth — verifying at the edge would pull Auth.js into the
// edge bundle. Stale/forged cookies still 401 downstream and trigger sign-out.
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
  // /topup/done is deliberately excluded: cross-site nav from Dodo doesn't
  // always carry our cookies; the page defers to /api/topup/status which
  // enforces auth itself.
  matcher: [
    "/dashboard/:path*",
    "/agents/:path*",
    "/topup",
    "/merchants/dashboard/:path*",
    "/merchants/apis/:path*",
    "/merchants/earnings/:path*",
  ],
};
