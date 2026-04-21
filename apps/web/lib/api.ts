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
  | "signing_failed";

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
