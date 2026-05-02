import "server-only";
import { createHash } from "node:crypto";
import { customAlphabet } from "nanoid";

// `mk_` prefix lets dual-auth fast-route to merchant_api_keys; otherwise
// fall through to NextAuth session.

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
