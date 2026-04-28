// Error codes surfaced from the Obscura backend (`/api/x402/sign`) plus
// SDK-local failure modes. The server codes mirror `apps/web/lib/api.ts`
// exactly — if you add a new one there, add it here too so consumers can
// type-check against the full set.

export type ObscuraErrorCode =
  // Server-side codes (propagated from `/api/x402/sign` error responses).
  // Kept in lockstep with `apps/web/lib/api.ts` — do not add a code here
  // that the server cannot actually emit.
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
  // SDK-side codes (thrown from this package)
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
