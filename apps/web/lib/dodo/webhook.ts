import "server-only";
import type { UnwrapWebhookEvent } from "dodopayments/resources/webhooks/webhooks";
import { dodo } from "@/lib/dodo/client";

export class WebhookVerifyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerifyError";
  }
}

/** Verify Dodo signature and unwrap. Throws on failure → route maps to 401 so Dodo stops retrying. */
export function verifyDodoWebhook(
  rawBody: string,
  requestHeaders: Headers,
): UnwrapWebhookEvent {
  const headers: Record<string, string> = {
    "webhook-id": requestHeaders.get("webhook-id") ?? "",
    "webhook-signature": requestHeaders.get("webhook-signature") ?? "",
    "webhook-timestamp": requestHeaders.get("webhook-timestamp") ?? "",
  };

  if (!headers["webhook-id"] || !headers["webhook-signature"]) {
    throw new WebhookVerifyError("missing signature headers");
  }

  try {
    return dodo.webhooks.unwrap(rawBody, { headers });
  } catch (err) {
    throw new WebhookVerifyError(
      err instanceof Error ? err.message : "signature verification failed",
    );
  }
}
