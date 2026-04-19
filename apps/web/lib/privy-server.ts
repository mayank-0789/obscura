import "server-only";
import { PrivyClient } from "@privy-io/server-auth";
import { env } from "@/lib/env";

// Server Privy client. Set PRIVY_AUTHORIZATION_KEY to enable delegated (no-prompt) signing.
export const privy = new PrivyClient(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET, {
  walletApi: env.PRIVY_AUTHORIZATION_KEY
    ? { authorizationPrivateKey: env.PRIVY_AUTHORIZATION_KEY }
    : undefined,
});
