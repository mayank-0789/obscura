import "server-only";
import { createHash } from "node:crypto";
import { customAlphabet } from "nanoid";

// Agent API keys are shown to the user once at creation and only the hash is
// stored. An agent's SDK sends this key on every /api/x402/sign call — it's the
// bearer token that binds an inbound request to an agent + user.
//
// Format: `pk_<28-char nanoid>`  → ~168 bits of entropy.
//
// Hashing: unsalted SHA-256. This is deliberate and correct for *high-entropy*
// secrets. Password-hashing KDFs like argon2/bcrypt exist to slow down brute
// force against low-entropy inputs (human passwords). Brute-forcing a random
// 168-bit key is computationally infeasible, so a per-row salt adds storage
// cost without defensive value. The industry convention for API keys (Stripe,
// Linear, GitHub tokens) is the same.

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const KEY_LENGTH = 28;
const generateId = customAlphabet(ALPHABET, KEY_LENGTH);

const PREFIX = "pk_";

export function generateAgentApiKey(): { plaintext: string; hash: string } {
  const plaintext = `${PREFIX}${generateId()}`;
  return { plaintext, hash: hashAgentApiKey(plaintext) };
}

export function hashAgentApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}
