import type { DefaultSession } from "next-auth";

// Augment Auth.js's Session.user to include the Google sub as `id`. Set in
// `lib/auth-config.ts`'s session callback. Server code reads `session.user.id`
// as the stable per-user identifier (foreign key into users table).
//
// `& DefaultSession["user"]` keeps the base fields (name/email/image) so the
// augmented type is a strict superset, not a replacement.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
