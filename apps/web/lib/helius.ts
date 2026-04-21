import "server-only";
import { env } from "@/lib/env";

// Helius Enhanced Webhooks client — we keep ONE webhook configured on Helius,
// watching a dynamic `accountAddresses` list. When a merchant signs up we GET
// the config, add their payout wallet to the list, and PUT it back.
//
// Best-effort by design: if the env vars aren't configured OR the PUT fails,
// we log and return — merchant creation still succeeds, dashboards just fall
// back to poll-only updates until an operator re-registers addresses.
//
// ⚠ GET → modify → PUT is not atomic. Two concurrent signups within the same
// ~500ms window can clobber each other's registrations — only the last PUT
// wins. Bounded in practice by the 1-per-10s create-merchant rate limit
// shared across /api/onboarding/role and /api/merchants, but a post-signup
// reconciler (enumerate merchants, ensure each payout_wallet is in the
// webhook's accountAddresses list) is the proper fix.
//
// Setup (one-time, done on Helius dashboard or via POST /v0/webhooks):
//   - webhookURL: https://<our-host>/api/webhooks/helius
//   - authHeader: send the RAW HELIUS_WEBHOOK_AUTH_TOKEN value — the inbound
//     verifier compares exact bytes. Do NOT prefix with "Bearer "; Helius
//     passes authHeader verbatim.
//   - transactionTypes: ["TRANSFER"] (or "Any" for belt + braces)
//   - accountAddresses: [] (initially empty; merchants are appended on signup)

const FETCH_TIMEOUT_MS = 5_000;

const BASE_URL = "https://api.helius.xyz";

type HeliusWebhookConfig = {
  webhookID?: string;
  wallet?: string;
  webhookURL: string;
  transactionTypes: string[];
  accountAddresses: string[];
  webhookType?: string;
  authHeader?: string;
};

/**
 * Append `pubkey` to the shared webhook's `accountAddresses`. Idempotent —
 * if the address is already in the list we skip the PUT. Does not throw on
 * network / auth failures; logs and returns.
 */
export async function registerMerchantPayoutAddress(
  pubkey: string,
): Promise<void> {
  if (!env.HELIUS_API_KEY || !env.HELIUS_WEBHOOK_ID) {
    console.warn(
      "[helius] HELIUS_API_KEY or HELIUS_WEBHOOK_ID missing — merchant push updates disabled. Dashboards will still poll.",
    );
    return;
  }

  try {
    const current = await fetchWebhookConfig();
    if (current.accountAddresses.includes(pubkey)) {
      // Already registered (e.g. previous signup retried).
      return;
    }
    const next: HeliusWebhookConfig = {
      ...current,
      accountAddresses: [...current.accountAddresses, pubkey],
    };
    await putWebhookConfig(next);
  } catch (err) {
    console.error(
      `[helius] registerMerchantPayoutAddress failed for ${pubkey}; continuing without push updates:`,
      err,
    );
  }
}

async function fetchWebhookConfig(): Promise<HeliusWebhookConfig> {
  const url = `${BASE_URL}/v0/webhooks/${env.HELIUS_WEBHOOK_ID}?api-key=${env.HELIUS_API_KEY}`;
  const res = await fetch(url, {
    cache: "no-store",
    // Timeout so a slow Helius response doesn't pin a Node worker / keep
    // the HTTP connection open indefinitely (the caller is fire-and-forget,
    // so there's no outer deadline to catch a hang).
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(
      `Helius GET webhook ${env.HELIUS_WEBHOOK_ID} → ${res.status}`,
    );
  }
  return (await res.json()) as HeliusWebhookConfig;
}

async function putWebhookConfig(
  config: HeliusWebhookConfig,
): Promise<HeliusWebhookConfig> {
  const url = `${BASE_URL}/v0/webhooks/${env.HELIUS_WEBHOOK_ID}?api-key=${env.HELIUS_API_KEY}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      webhookURL: config.webhookURL,
      transactionTypes: config.transactionTypes,
      accountAddresses: config.accountAddresses,
      webhookType: config.webhookType,
      authHeader: config.authHeader,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Helius PUT webhook ${env.HELIUS_WEBHOOK_ID} → ${res.status} ${text}`,
    );
  }
  return (await res.json()) as HeliusWebhookConfig;
}
