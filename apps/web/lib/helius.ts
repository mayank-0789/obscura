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
// shared across /api/onboarding/role and /api/merchants. The safety-net is
// `reconcileMerchantPayoutAddresses` below, exposed via
// POST /api/admin/helius/reconcile — run it periodically (cron or manual) to
// diff-merge any addresses that got dropped by a race back onto Helius.
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

/**
 * Diff-merge reconciler for the shared webhook's `accountAddresses` list.
 * Fixes drift from the GET-modify-PUT race in `registerMerchantPayoutAddress`
 * (two concurrent signups can clobber each other: second PUT drops first's
 * addition) and surfaces any Helius-side config drift (manual edits, failed
 * signup-time registrations).
 *
 * Takes the authoritative list of payout wallets from the caller (typically
 * enumerated from the `merchants` table) and ensures every one is present in
 * Helius. Never removes addresses — a wallet missing from the merchants table
 * is more likely a stale DB read than a deletion intent, and removing it
 * silently would break real-time events for any merchant still transacting.
 *
 * Returns the diff so callers (operator cron, admin endpoint) can log it.
 */
export type HeliusReconcileResult =
  | { ok: false; reason: "not_configured" }
  | {
      ok: true;
      heliusCount: number;
      dbCount: number;
      addressesAdded: string[];
      addressesAlreadyPresent: number;
    };

export async function reconcileMerchantPayoutAddresses(
  dbWallets: string[],
): Promise<HeliusReconcileResult> {
  if (!env.HELIUS_API_KEY || !env.HELIUS_WEBHOOK_ID) {
    return { ok: false, reason: "not_configured" };
  }

  const current = await fetchWebhookConfig();
  const heliusSet = new Set(current.accountAddresses);
  const missing = dbWallets.filter((w) => !heliusSet.has(w));

  if (missing.length === 0) {
    return {
      ok: true,
      heliusCount: current.accountAddresses.length,
      dbCount: dbWallets.length,
      addressesAdded: [],
      addressesAlreadyPresent: dbWallets.length,
    };
  }

  const next: HeliusWebhookConfig = {
    ...current,
    accountAddresses: [...current.accountAddresses, ...missing],
  };
  await putWebhookConfig(next);

  return {
    ok: true,
    heliusCount: current.accountAddresses.length,
    dbCount: dbWallets.length,
    addressesAdded: missing,
    addressesAlreadyPresent: dbWallets.length - missing.length,
  };
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
