import { NextResponse } from "next/server";

type ErrorCode =
  | "missing_token"
  | "invalid_token"
  | "user_not_synced"
  | "not_found"
  | "bad_request"
  | "server_error";

const STATUS: Record<ErrorCode, number> = {
  missing_token: 401,
  invalid_token: 401,
  user_not_synced: 404,
  not_found: 404,
  bad_request: 400,
  server_error: 500,
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
