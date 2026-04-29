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
    // Auth.js v5 sets user.id to a fresh crypto.randomUUID() on every OAuth
    // callback when there's no DB adapter — see @auth/core
    // lib/actions/callback/oauth/callback.js getUserAndAccount(). The Google
    // sub is preserved as account.providerAccountId, but only persisted by an
    // adapter; we run JWT-only, so we MUST pin token.sub to the real sub here
    // or every sign-in mints a new users.auth_id → duplicate user rows.
    async jwt({ token, account, profile }) {
      if (account?.provider === "google") {
        const googleSub =
          (profile as { sub?: string } | null)?.sub ?? account.providerAccountId;
        if (googleSub) token.sub = googleSub;
      }
      return token;
    },
    // Expose the (now stable) Google sub as `session.user.id` so server code
    // has a single foreign key into our `users` table.
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
