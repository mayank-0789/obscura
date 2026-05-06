import "server-only";
import { env } from "@/lib/env";

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
 * Append pubkey to webhook's `accountAddresses`. Idempotent. GET-modify-PUT
 * isn't atomic — concurrent signups can clobber; reconciler is the safety net.
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
 * Diff-merge reconciler for webhook drift. Never removes addresses — a missing
 * wallet is more likely a stale read than a deletion intent.
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
