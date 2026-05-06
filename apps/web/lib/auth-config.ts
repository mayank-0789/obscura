import NextAuth from "next-auth";
import type { NextAuthResult } from "next-auth";
import Google from "next-auth/providers/google";
import { eq } from "drizzle-orm";
import { db, users } from "@/lib/db";
import { env } from "@/lib/env";

// Explicit `NextAuthResult` annotation avoids TS2742 "inferred type cannot be named".
const nextAuth: NextAuthResult = NextAuth({
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  ],
  trustHost: true,
  session: { strategy: "jwt" },
  callbacks: {
    // Auth.js v5 trap: with no DB adapter, user.id is a fresh randomUUID() per
    // OAuth callback. Pin token.sub to the real Google sub or every sign-in
    // mints a new users.auth_id row.
    async jwt({ token, account, profile }) {
      if (account?.provider === "google") {
        const googleSub =
          (profile as { sub?: string } | null)?.sub ?? account.providerAccountId;
        if (googleSub) token.sub = googleSub;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.sub && session.user) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  events: {
    // Audit signout. Must NOT live at /api/auth/signout — that path shadows
    // Auth.js's own cookie-clearing handler and silently breaks signout.
    async signOut(message) {
      const sub = "token" in message ? message.token?.sub : undefined;
      if (!sub) return;
      try {
        await db
          .update(users)
          .set({ updatedAt: new Date() })
          .where(eq(users.authId, sub));
      } catch (err) {
        console.error("[auth/events.signOut] db update failed", err);
      }
    },
  },
});

export const handlers: NextAuthResult["handlers"] = nextAuth.handlers;
export const auth: NextAuthResult["auth"] = nextAuth.auth;
export const signIn: NextAuthResult["signIn"] = nextAuth.signIn;
export const signOut: NextAuthResult["signOut"] = nextAuth.signOut;
