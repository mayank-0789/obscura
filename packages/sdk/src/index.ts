/**
 * @obscura-app/sdk — pay-per-call SDK for AI agents.
 *
 * Wraps the native `fetch` with automatic x402 handling: when an HTTP call
 * receives a 402 with a `PAYMENT-REQUIRED` header, the SDK asks the Obscura
 * backend to execute a confidential Umbra mixer transfer from the agent's
 * encrypted balance to the merchant's, then retries the original request
 * with a `PAYMENT-SIGNATURE` header carrying the on-chain proofs. The
 * agent's encrypted balance, the signing key, and Umbra subject identity
 * never leave Obscura's backend — the agent only holds an API key.
 *
 *   npm install @obscura-app/sdk
 *
 *   import { Obscura } from "@obscura-app/sdk";
 *   const agent = new Obscura({
 *     apiKey: process.env.OBSCURA_KEY!,
 *     baseUrl: process.env.OBSCURA_BASE_URL!, // e.g. https://<your-app>.up.railway.app
 *   });
 *   const res = await agent.fetch("https://your-merchant.example.com/top");
 *   const json = await res.json();
 */

import { ObscuraError, type ObscuraErrorCode } from "./errors.js";

export { ObscuraError, type ObscuraErrorCode };

export type ObscuraOptions = {
  /** Agent API key from the Obscura dashboard. Format: `pk_<28 chars>`. */
  apiKey: string;
  /**
   * Base URL of the Obscura backend that will sign your agent's payments.
   * Required — point it at whatever host you've deployed the Obscura web
   * app on (Railway, Vercel, your own domain). No default is shipped so
   * callers can't silently talk to a wrong/dead host. Example:
   * `"https://my-obscura.up.railway.app"`.
   */
  baseUrl: string;
  /**
   * Optional fetch implementation. Defaults to `globalThis.fetch`. Useful
   * for injecting undici in Node, a mock in tests, or a proxy-wrapped
   * fetch in an edge runtime.
   */
  fetch?: typeof fetch;
  /**
   * Per-request timeout for the `/api/x402/sign` call, in milliseconds.
   * The Umbra mixer transfer involves a Groth16 ZK proof (~10–30s) plus
   * an Arcium MPC callback round-trip — the cold-path P99 lands around
   * 45s. Default 60_000 ms gives headroom without leaving zombie requests
   * alive forever. Bump only if you've measured your environment hitting
   * the ceiling on cold cache.
   */
  signTimeoutMs?: number;
  /**
   * Maximum retry attempts on transient failures (network errors, 5xx
   * server errors, timeouts). 0 disables auto-retry entirely. Default 2
   * — enough to ride through a single flapping RPC or relayer hiccup
   * without piling on for chronic outages.
   *
   * **Terminal errors are never retried**, regardless of this setting:
   * `conflict` (the original request is in flight), `over_cap`,
   * `agent_inactive`, `invalid_token`, `invalid_challenge` — retrying
   * them just wastes round-trips.
   */
  signMaxRetries?: number;
  /**
   * Initial backoff delay in milliseconds before the FIRST retry.
   * Subsequent retries double this (exponential). Default 500 ms →
   * retries land at 500ms, 1000ms, 2000ms, ... offsets. Capped at 8s.
   */
  signRetryBaseMs?: number;
};

const DEFAULT_SIGN_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_MS = 500;
const MAX_RETRY_BACKOFF_MS = 8_000;

// Codes that the server will return the same response for no matter how many
// times we ask. Retrying them just burns budget — surface them to the caller
// immediately. Anything NOT in this set (network_error, server_error,
// timeout, server-side rate_limited) gets an exponential-backoff retry.
const TERMINAL_CODES = new Set<ObscuraErrorCode>([
  "conflict",
  "over_cap",
  "insufficient_funds",
  "agent_inactive",
  "invalid_token",
  "missing_token",
  "invalid_challenge",
  "no_payment_required_header",
  "bad_request",
]);

export class Obscura {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #signTimeoutMs: number;
  readonly #signMaxRetries: number;
  readonly #signRetryBaseMs: number;

  constructor(options: ObscuraOptions) {
    if (!options.apiKey) {
      throw new ObscuraError("bad_request", "Obscura: apiKey is required");
    }
    if (!options.baseUrl) {
      throw new ObscuraError(
        "bad_request",
        "Obscura: baseUrl is required (e.g. https://<your-app>.up.railway.app)",
      );
    }
    this.#apiKey = options.apiKey;
    this.#baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#signTimeoutMs = options.signTimeoutMs ?? DEFAULT_SIGN_TIMEOUT_MS;
    this.#signMaxRetries = options.signMaxRetries ?? DEFAULT_MAX_RETRIES;
    this.#signRetryBaseMs = options.signRetryBaseMs ?? DEFAULT_RETRY_BASE_MS;
  }

  /**
   * Make an HTTP request. Identical to `fetch` for non-402 responses.
   * On 402 + `PAYMENT-REQUIRED` header, signs + retries transparently.
   *
   * Throws `ObscuraError` on any sign-flow failure — inspect `err.code` to
   * distinguish "over_cap" / "invalid_challenge" / "network_error" / etc.
   */
  async fetch(
    input: string | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = typeof input === "string" ? input : input.toString();
    const initial = await this.#fetch(url, init);
    if (initial.status !== 402) return initial;

    const paymentRequiredHeader =
      initial.headers.get("payment-required") ??
      initial.headers.get("PAYMENT-REQUIRED");
    if (!paymentRequiredHeader) {
      throw new ObscuraError(
        "no_payment_required_header",
        "Merchant returned 402 but no PAYMENT-REQUIRED header — this is an x402 protocol violation by the merchant.",
      );
    }

    const paymentSignatureHeader = await this.#requestSignatureWithRetry(
      paymentRequiredHeader,
      url,
    );

    // Merge via Headers so callers who pass `new Headers(...)` or the
    // `[[k, v], ...]` array form don't silently lose their own headers.
    // The naïve `{ ...init.headers, "PAYMENT-SIGNATURE": ... }` only works
    // for plain-object headers and is a silent data-loss bug otherwise.
    const mergedHeaders = new Headers(init?.headers);
    mergedHeaders.set("PAYMENT-SIGNATURE", paymentSignatureHeader);

    return this.#fetch(url, { ...init, headers: mergedHeaders });
  }

  async #requestSignatureWithRetry(
    paymentRequiredHeader: string,
    resourceUrl: string,
  ): Promise<string> {
    let attempt = 0;
    let lastErr: unknown;
    // attempt 0 is the original; attempts 1..N are retries.
    while (attempt <= this.#signMaxRetries) {
      try {
        return await this.#requestSignature(paymentRequiredHeader, resourceUrl);
      } catch (err) {
        lastErr = err;
        if (!(err instanceof ObscuraError) || TERMINAL_CODES.has(err.code)) {
          throw err;
        }
        if (attempt === this.#signMaxRetries) {
          throw err;
        }
        const delayMs = Math.min(
          this.#signRetryBaseMs * Math.pow(2, attempt),
          MAX_RETRY_BACKOFF_MS,
        );
        await sleep(delayMs);
        attempt += 1;
      }
    }
    // Unreachable — the loop either returns or throws — but TS needs it.
    throw lastErr;
  }

  async #requestSignature(
    paymentRequiredHeader: string,
    resourceUrl: string,
  ): Promise<string> {
    // AbortController-backed timeout. Without it, a stuck Obscura backend
    // would hold the agent's request open indefinitely — bad for retry
    // policies and worse for serverless agents with their own deadlines.
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.#signTimeoutMs,
    );

    let res: Response;
    try {
      res = await this.#fetch(`${this.#baseUrl}/api/x402/sign`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentRequiredHeader, resourceUrl }),
        signal: controller.signal,
      });
    } catch (err) {
      if (controller.signal.aborted) {
        throw new ObscuraError(
          "timeout",
          `Obscura /api/x402/sign exceeded ${this.#signTimeoutMs}ms — ` +
            "the mixer transfer may still complete server-side; do NOT retry " +
            "without verifying the prior request didn't land",
          { cause: err },
        );
      }
      throw new ObscuraError(
        "network_error",
        `Could not reach Obscura at ${this.#baseUrl}`,
        { cause: err },
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      const code: ObscuraErrorCode =
        isKnownCode(body.error) ? body.error : "unknown";
      const message = body.message
        ? `Obscura /api/x402/sign failed (${res.status}): ${code} — ${body.message}`
        : `Obscura /api/x402/sign failed (${res.status}): ${code}`;
      throw new ObscuraError(code, message, { status: res.status });
    }

    const json = (await res.json().catch(() => null)) as {
      paymentSignatureHeader?: string;
    } | null;
    if (!json?.paymentSignatureHeader) {
      throw new ObscuraError(
        "server_error",
        "Obscura /api/x402/sign returned no paymentSignatureHeader",
      );
    }
    return json.paymentSignatureHeader;
  }
}

const KNOWN_CODES = new Set<ObscuraErrorCode>([
  "missing_token",
  "invalid_token",
  "agent_inactive",
  "invalid_challenge",
  "over_cap",
  "insufficient_funds",
  "rate_limited",
  "conflict",
  "signing_failed",
  "bad_request",
  "server_error",
  "no_payment_required_header",
  "network_error",
  "timeout",
  "unknown",
]);

function isKnownCode(code: unknown): code is ObscuraErrorCode {
  return typeof code === "string" && KNOWN_CODES.has(code as ObscuraErrorCode);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
