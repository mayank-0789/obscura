import { ObscuraError, type ObscuraErrorCode } from "./errors.js";

export { ObscuraError, type ObscuraErrorCode };

export type ObscuraOptions = {
  /** Agent API key from the Obscura dashboard. Format: `pk_<28 chars>`. */
  apiKey: string;
  /** Base URL of the Obscura backend that signs your agent's payments. */
  baseUrl: string;
  /** Override fetch (undici / mocks / proxies). Defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** Per-request timeout for /api/x402/sign in ms. Default 60_000. */
  signTimeoutMs?: number;
  /** Max retries on transient failures (network/5xx/timeouts). Default 2. */
  signMaxRetries?: number;
  /** Initial backoff before first retry; doubles each attempt, cap 8s. Default 500. */
  signRetryBaseMs?: number;
};

const DEFAULT_SIGN_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_RETRY_BASE_MS = 500;
const MAX_RETRY_BACKOFF_MS = 8_000;

// signing_failed + timeout are terminal because the on-chain debit may have
// landed; retrying would risk a second debit. The rest are terminal because
// retrying can't change the outcome (over_cap, insufficient_funds, etc.).
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
  "signing_failed",
  "timeout",
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
   * Drop-in fetch replacement. On a 402 + PAYMENT-REQUIRED header, signs via
   * Obscura and retries with the PAYMENT-SIGNATURE header. Throws ObscuraError
   * on sign-flow failure — inspect `err.code`.
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
        "Merchant returned 402 but no PAYMENT-REQUIRED header — x402 protocol violation by the merchant.",
      );
    }

    const paymentSignatureHeader = await this.#requestSignatureWithRetry(
      paymentRequiredHeader,
      url,
    );

    // Merge via Headers so callers passing `new Headers(...)` or `[[k,v]]` form
    // don't silently lose their own headers.
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
    throw lastErr;
  }

  async #requestSignature(
    paymentRequiredHeader: string,
    resourceUrl: string,
  ): Promise<string> {
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
