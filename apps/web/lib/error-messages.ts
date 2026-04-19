// Map server-issued error codes (see lib/api.ts) to user-facing copy. Keep
// the strings short, specific, and actionable — they surface in toasts next
// to a failed action, not in a dedicated error page.
const FALLBACK = "Something broke on our side. Try again in a moment.";

const MESSAGES: Record<string, string> = {
  bad_request: "Check the values and try again.",
  missing_token: "Please sign in and try again.",
  invalid_token: "Your session expired. Sign in again.",
  invalid_signature: "This request couldn't be verified. Please try again.",
  user_not_synced: "Your account isn't set up yet — refresh the page.",
  not_found: "We couldn't find that.",
  rate_limited: "You're doing that too often. Wait a minute and retry.",
  agent_limit_reached: "You've hit the agent limit for this account.",
  server_error: FALLBACK,
};

export function describeError(code?: string): string {
  if (!code) return FALLBACK;
  return MESSAGES[code] ?? FALLBACK;
}
