import { NextRequest, NextResponse } from "next/server";

// First-gate: presence of a Privy cookie. Real JWT verification happens in each API route.
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
