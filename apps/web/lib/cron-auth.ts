import "server-only";
import { env } from "@/lib/env";
import { apiError } from "@/lib/api";

/**
 * Bearer guard for `/api/cron/*`. Fail-closed in production (forgotten env
 * var must not expose cron endpoints); non-prod allows with a warning.
 */
export function cronAuthGuard(req: Request): Response | null {
  const secret = env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[cron-auth] CRON_SECRET unset in production — refusing request. " +
          "Set CRON_SECRET in the deployment environment to enable cron routes.",
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
