export type MerchantSdkConfig = {
  /** Solana address (base58) where payments should land. */
  payoutWallet: string;
  /** Simple network name — "solana" or "solana-devnet". Defaults to devnet. */
  network?: "solana" | "solana-devnet";
  /** Stablecoin mint. Defaults to the canonical USDC for the selected network. */
  mint?: string;
  /** Stablecoin decimals. Defaults to 6 (USDC / USDG). */
  decimals?: number;
  /** Facilitator URL. Defaults to PayAI's public devnet facilitator. */
  facilitatorUrl?: string;
  /** Override the RPC URL used for chain reads. */
  rpcUrl?: string;
  /**
   * PayAI JWT auth (optional — free tier needs neither). Set both to enable.
   */
  apiKeyId?: string;
  apiKeySecret?: string;
};

/**
 * Per-route pricing config. `amount` is atomic units as a string (e.g. "10000"
 * = $0.01 of a 6-decimal stablecoin). Leave `asset` undefined to inherit from
 * the SDK's `mint` / `decimals`.
 */
export type ChargeConfig = {
  /** Atomic-unit price string. "10000" for $0.01 USDC. */
  amount: string;
  /** Human-readable description surfaced in the 402 body. */
  description?: string;
  /** Response MIME type advertised in the 402 body. Default application/json. */
  mimeType?: string;
  /** Client-side max wait for payment in seconds. Default 300. */
  maxTimeoutSeconds?: number;
  /** Override the SDK-default mint+decimals for this route only. */
  asset?: { address: string; decimals: number };
};

