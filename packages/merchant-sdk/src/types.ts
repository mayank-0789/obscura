export type MerchantSdkConfig = {
  /**
   * The merchant's Umbra-side ETA address (Solana pubkey, base58). This is
   * NOT a regular SPL wallet — it's the deterministic public key of the
   * merchant's Umbra encrypted token account, registered server-side at
   * merchant signup. Pay-out instructions in the 402 challenge use this as
   * the recipient.
   */
  merchantEtaAddress: string;
  /** "solana" (mainnet) or "solana-devnet". Defaults to devnet. */
  network?: "solana" | "solana-devnet";
  /** Stablecoin mint. Defaults to the canonical USDC for the selected network. */
  mint?: string;
  /** Stablecoin decimals. Defaults to 6 (USDC / USDG). */
  decimals?: number;
  /**
   * Solana RPC URL for on-chain envelope verification. Helius works well;
   * any provider that exposes `getTransaction` is fine. Defaults to
   * `https://api.devnet.solana.com` for `solana-devnet` and the public
   * mainnet endpoint for `solana` — both rate-limited; pass your own RPC
   * for production load.
   */
  rpcUrl?: string;
  /**
   * Replay-protection window in milliseconds. Queue signatures presented
   * by an agent SDK are tracked in-memory and rejected on duplicate within
   * this window. Default 5 minutes — long enough to cover a slow client
   * retry cycle, short enough that the in-memory map doesn't grow without
   * bound on a busy merchant.
   */
  replayWindowMs?: number;
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
