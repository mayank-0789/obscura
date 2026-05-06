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
  | "agent_inactive"
  | "invalid_challenge"
  | "over_cap"
  | "signing_failed"
  // SDK must NOT retry — original request is still in-flight.
  | "conflict"
  | "insufficient_funds"
  | "rate_unavailable";

const STATUS: Record<ErrorCode, number> = {
  missing_token: 401,
  invalid_token: 401,
  invalid_signature: 401,
  forbidden: 403,
  user_not_synced: 404,
  not_found: 404,
  bad_request: 400,
  rate_limited: 429,
  agent_limit_reached: 400,
  server_error: 500,
  agent_inactive: 403,
  invalid_challenge: 400,
  over_cap: 402,
  signing_failed: 500,
  conflict: 409,
  insufficient_funds: 402,
  rate_unavailable: 503,
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
