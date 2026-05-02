import "server-only";
import { createHash } from "node:crypto";
import { customAlphabet } from "nanoid";

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
