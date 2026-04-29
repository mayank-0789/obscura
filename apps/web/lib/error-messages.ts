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
  // x402 agent-flow codes — surfaced by the SDK when /api/x402/sign rejects.
  agent_inactive:
    "This agent is paused or cancelled. Reactivate it to resume payments.",
  invalid_challenge:
    "The merchant's payment request was rejected as invalid or expired.",
  over_cap:
    "This payment would exceed the agent's monthly spend cap. Raise the cap or wait for the next cycle.",
  signing_failed:
    "We couldn't sign the payment. Try again; if this persists, check the agent's status.",
  // Duplicate request collapsed mid-flight by /api/x402/sign. Terminal — the
  // SDK never retries this. Tell the user to wait, not to retry.
  conflict:
    "This payment is already in flight. Wait for the original to finish before retrying.",
  // Agent's encrypted balance is below the requested spend amount. Terminal —
  // only a top-up resolves it. Avoid generic "try again" copy here.
  insufficient_funds:
    "The agent doesn't have enough balance for this payment. Top it up to continue.",
  server_error: FALLBACK,
};

export function describeError(code?: string): string {
  if (!code) return FALLBACK;
  return MESSAGES[code] ?? FALLBACK;
}
