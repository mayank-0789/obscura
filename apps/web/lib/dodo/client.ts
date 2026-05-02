import "server-only";
import DodoPayments from "dodopayments";
import { env } from "@/lib/env";

export const dodo = new DodoPayments({
  bearerToken: env.DODO_PAYMENTS_API_KEY,
  environment: env.DODO_ENVIRONMENT,
  webhookKey: env.DODO_WEBHOOK_KEY,
});
