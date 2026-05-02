export type MerchantSdkConfig = {
  /** Merchant's Umbra-side ETA address (Solana pubkey, base58). NOT a regular SPL wallet. */
  merchantEtaAddress: string;
  /** "solana" (mainnet) or "solana-devnet". Defaults to devnet. */
  network?: "solana" | "solana-devnet";
  /** Stablecoin mint. Defaults to canonical USDC for the selected network. */
  mint?: string;
  /** Stablecoin decimals. Default 6 (USDC/USDG). WSOL is 9. */
  decimals?: number;
  /** Solana RPC URL. Defaults to the public endpoint — bring your own for prod load. */
  rpcUrl?: string;
  /** Replay window for queueSignatures, ms. Default 5 min. */
  replayWindowMs?: number;
};

export type ChargeConfig = {
  /** Atomic-unit price string. "10000" for $0.01 USDC. */
  amount: string;
  /** Description shown in the 402 body. */
  description?: string;
  /** Response MIME advertised in 402. Default application/json. */
  mimeType?: string;
  /** Client-side max wait for payment (s). Default 300. */
  maxTimeoutSeconds?: number;
  /** Override SDK-default mint+decimals for this route only. */
  asset?: { address: string; decimals: number };
};
