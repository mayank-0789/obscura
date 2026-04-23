/**
 * @payrail-app/sdk — pay-per-call SDK for AI agents.
 *
 * Wraps the native `fetch` with automatic x402 handling: when an HTTP call
 * receives a 402 with a `PAYMENT-REQUIRED` header, the SDK asks the Payrail
 * backend to sign a Solana payment via Privy delegated signing, then retries
 * the original request with a `PAYMENT-SIGNATURE` header. The agent's
 * wallet, the Solana chain, and the signing key never leave Payrail's
 * backend — the agent only holds an API key.
 *
 *   npm install @payrail-app/sdk
 *
 *   import { Payrail } from "@payrail-app/sdk";
 *   const agent = new Payrail({
 *     apiKey: process.env.PAYRAIL_KEY!,
 *     baseUrl: process.env.PAYRAIL_BASE_URL!, // e.g. https://<your-app>.up.railway.app
 *   });
 *   const res = await agent.fetch("https://your-merchant.example.com/top");
 *   const json = await res.json();
 */

import { PayrailError, type PayrailErrorCode } from "./errors.js";

export { PayrailError, type PayrailErrorCode };

export type PayrailOptions = {
  /** Agent API key from the Payrail dashboard. Format: `pk_<28 chars>`. */
  apiKey: string;
  /**
   * Base URL of the Payrail backend that will sign your agent's payments.
   * Required — point it at whatever host you've deployed the Payrail web
   * app on (Railway, Vercel, your own domain). No default is shipped so
   * callers can't silently talk to a wrong/dead host. Example:
   * `"https://my-payrail.up.railway.app"`.
   */
  baseUrl: string;
  /**
   * Optional fetch implementation. Defaults to `globalThis.fetch`. Useful
   * for injecting undici in Node, a mock in tests, or a proxy-wrapped
   * fetch in an edge runtime.
   */
  fetch?: typeof fetch;
};

export class Payrail {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  constructor(options: PayrailOptions) {
    if (!options.apiKey) {
      throw new PayrailError("bad_request", "Payrail: apiKey is required");
    }
    if (!options.baseUrl) {
      throw new PayrailError(
        "bad_request",
        "Payrail: baseUrl is required (e.g. https://<your-app>.up.railway.app)",
      );
    }
    this.#apiKey = options.apiKey;
    this.#baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /**
   * Make an HTTP request. Identical to `fetch` for non-402 responses.
   * On 402 + `PAYMENT-REQUIRED` header, signs + retries transparently.
   *
   * Throws `PayrailError` on any sign-flow failure — inspect `err.code` to
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
      throw new PayrailError(
        "no_payment_required_header",
        "Merchant returned 402 but no PAYMENT-REQUIRED header — this is an x402 protocol violation by the merchant.",
      );
    }

    const paymentSignatureHeader = await this.#requestSignature(
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

  async #requestSignature(
    paymentRequiredHeader: string,
    resourceUrl: string,
  ): Promise<string> {
    let res: Response;
    try {
      res = await this.#fetch(`${this.#baseUrl}/api/x402/sign`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ paymentRequiredHeader, resourceUrl }),
      });
    } catch (err) {
      throw new PayrailError(
        "network_error",
        `Could not reach Payrail at ${this.#baseUrl}`,
        { cause: err },
      );
    }

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
      };
      const code: PayrailErrorCode =
        isKnownCode(body.error) ? body.error : "unknown";
      const message = body.message
        ? `Payrail /api/x402/sign failed (${res.status}): ${code} — ${body.message}`
        : `Payrail /api/x402/sign failed (${res.status}): ${code}`;
      throw new PayrailError(code, message, { status: res.status });
    }

    const json = (await res.json().catch(() => null)) as {
      paymentSignatureHeader?: string;
    } | null;
    if (!json?.paymentSignatureHeader) {
      throw new PayrailError(
        "server_error",
        "Payrail /api/x402/sign returned no paymentSignatureHeader",
      );
    }
    return json.paymentSignatureHeader;
  }
}

const KNOWN_CODES = new Set<PayrailErrorCode>([
  "missing_token",
  "invalid_token",
  "agent_inactive",
  "invalid_challenge",
  "over_cap",
  "signing_failed",
  "bad_request",
  "server_error",
  "no_payment_required_header",
  "network_error",
  "unknown",
]);

function isKnownCode(code: unknown): code is PayrailErrorCode {
  return typeof code === "string" && KNOWN_CODES.has(code as PayrailErrorCode);
}
