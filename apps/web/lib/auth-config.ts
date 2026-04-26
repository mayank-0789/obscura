import NextAuth from "next-auth";
import type { NextAuthResult } from "next-auth";
import Google from "next-auth/providers/google";
import { env } from "@/lib/env";

// Auth.js v5 (NextAuth) — single Google provider, JWT session strategy.
// `auth()` reads the active session in route handlers / server components.
// `handlers` is exported from /api/auth/[...nextauth]/route.ts.
// Client components use `signIn` / `signOut` from `next-auth/react` directly.
//
// Explicit `NextAuthResult` annotation avoids a TS2742 "inferred type cannot
// be named" error — without it, tsc tries to reach private @auth/core
// internals to spell out the destructured exports' types.
const nextAuth: NextAuthResult = NextAuth({
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  ],
  // App is single-host today; trust the inferred host so dev + previews + prod
  // all work without manual AUTH_URL config.
  trustHost: true,
  session: { strategy: "jwt" },
  callbacks: {
    // Surface the Google subject (`token.sub`) as `session.user.id` so server
    // code has a single stable identifier per signed-in user — used as the
    // foreign key into our `users` table.
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});

export const handlers: NextAuthResult["handlers"] = nextAuth.handlers;
export const auth: NextAuthResult["auth"] = nextAuth.auth;
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn;
export const signOut: NextAuthResult["signOut"] = nextAuth.signOut;
