import "server-only";
import { createHash } from "node:crypto";
import { customAlphabet } from "nanoid";

// Merchant API keys — same shape as agent API keys (see lib/agent-keys.ts for
// the full rationale). Used for programmatic access to /api/merchants/me/*
// endpoints (scripts, CI, webhook subscriptions).
//
// Format: `mk_<28-char nanoid>` → ~168 bits of entropy.
//
// Hashing: unsalted SHA-256 (same as agent keys — key material is
// high-entropy so KDFs add nothing, a per-row salt adds storage for zero
// defensive value).
//
// Distinct prefix (mk_ vs pk_) lets the dual-auth guard fast-route an mk_
// Bearer token to merchant_api_keys; absent that prefix it falls through to
// the cookie-based NextAuth session path.

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const KEY_LENGTH = 28;
const generateId = customAlphabet(ALPHABET, KEY_LENGTH);

const PREFIX = "mk_";

export const MERCHANT_KEY_PREFIX = PREFIX;

export function generateMerchantApiKey(): {
  plaintext: string;
  hash: string;
} {
  const plaintext = `${PREFIX}${generateId()}`;
  return { plaintext, hash: hashMerchantApiKey(plaintext) };
}

export function hashMerchantApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}
