import "server-only";
import { env } from "@/lib/env";
import { apiError } from "@/lib/api";

/**
 * Bearer-token guard for `/api/cron/*` routes.
 *
 * Vercel Cron fires each scheduled invocation with an `Authorization: Bearer
 * <CRON_SECRET>` header. Without this guard, anyone on the internet could
 * spam our cron endpoints — triggering Groth16 proves on demand, debiting
 * budgets, hitting the Helius RPC quota.
 *
 * Behavior:
 * - **`CRON_SECRET` set + token matches** → returns `null` (caller proceeds).
 * - **`CRON_SECRET` set + token wrong/missing** → returns 401 Response.
 * - **`CRON_SECRET` unset + `NODE_ENV !== 'production'`** → logs a warning
 *   and returns `null`. Lets you `curl` cron routes during local dev without
 *   juggling tokens.
 * - **`CRON_SECRET` unset + `NODE_ENV === 'production'`** → fails closed
 *   with 401 and a loud server log. Refusing to expose cron endpoints in
 *   production is a deliberate safety belt against forgotten env vars.
 *
 * @returns A `Response` (401) when the request is rejected, or `null` when
 *   the caller should proceed. Idiomatic shape matching `authGuard` in
 *   `lib/auth.ts`.
 */
export function cronAuthGuard(req: Request): Response | null {
  const secret = env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[cron-auth] CRON_SECRET unset in production — refusing request. " +
          "Set CRON_SECRET in the Vercel project to enable cron routes.",
      );
      return apiError("missing_token");
    }
    console.warn(
      "[cron-auth] CRON_SECRET not set — allowing request (dev mode). " +
        "DO NOT deploy without setting CRON_SECRET in production.",
    );
    return null;
  }

  const header = req.headers.get("authorization");
  if (!header) return apiError("missing_token");
  const expected = `Bearer ${secret}`;
  if (header !== expected) return apiError("invalid_token");
  return null;
}
