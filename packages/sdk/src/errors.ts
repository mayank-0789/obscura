// Only codes emitted by agent-key routes; user-JWT codes are intentionally absent.
export type ObscuraErrorCode =
  | "missing_token"
  | "invalid_token"
  | "agent_inactive"
  | "invalid_challenge"
  | "over_cap"
  | "insufficient_funds"
  | "rate_limited"
  | "conflict"
  | "signing_failed"
  | "bad_request"
  | "server_error"
  | "no_payment_required_header"
  | "network_error"
  | "timeout"
  | "unknown";

export class ObscuraError extends Error {
  public readonly code: ObscuraErrorCode;
  public readonly status?: number;

  constructor(
    code: ObscuraErrorCode,
    message: string,
    opts?: { status?: number; cause?: unknown },
  ) {
    super(message, opts?.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "ObscuraError";
    this.code = code;
    if (opts?.status !== undefined) this.status = opts.status;
  }
}
