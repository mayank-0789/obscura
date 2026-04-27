import { NextResponse } from "next/server";

type ErrorCode =
  | "missing_token"
  | "invalid_token"
  | "invalid_signature"
  | "forbidden"
  | "user_not_synced"
  | "not_found"
  | "bad_request"
  | "rate_limited"
  | "agent_limit_reached"
  | "server_error"
  // x402 agent-authenticated routes
  | "agent_inactive"
  | "invalid_challenge"
  | "over_cap"
  | "signing_failed"
  // Duplicate request collapsed by /api/x402/sign in-flight de-dup. Distinct
  // from rate_limited so SDK retry policy can treat them differently:
  // rate_limited = back off; conflict = the original is still working, do
  // NOT issue a fresh request for the same intent.
  | "conflict"
  // Agent's encrypted balance is below the requested spend amount. Caught
  // BEFORE the cap counter is debited so the cap stays consistent. SDK should
  // surface as a terminal error — retry can't help; user must top up.
  | "insufficient_funds";

const STATUS: Record<ErrorCode, number> = {
  missing_token: 401,
  invalid_token: 401,
  invalid_signature: 401,
  // Caller is authenticated but lacks privilege for the action (e.g. an mk_
  // API key attempting a session-only operation like minting more keys).
  forbidden: 403,
  user_not_synced: 404,
  not_found: 404,
  bad_request: 400,
  rate_limited: 429,
  agent_limit_reached: 400,
  server_error: 500,
  // x402
  agent_inactive: 403,
  invalid_challenge: 400,
  over_cap: 402,
  signing_failed: 500,
  conflict: 409,
  // 402 Payment Required — same status as over_cap; the SDK distinguishes
  // by error code. Both are terminal.
  insufficient_funds: 402,
};

export function apiError(code: ErrorCode, message?: string) {
  return NextResponse.json(
    message ? { error: code, message } : { error: code },
    { status: STATUS[code] },
  );
}

export function apiOk<T>(data: T, init?: { status?: number }) {
  return NextResponse.json(data, init);
}
