/**
 * @obscura-app/merchant-sdk — Express-style middleware for API sellers who want
 * to accept confidential x402 payments on Solana via the Umbra mixer.
 *
 *   npm install @obscura-app/merchant-sdk
 *
 *   import express from "express";
 *   import { payrail } from "@obscura-app/merchant-sdk";
 *
 *   const pay = payrail({
 *     merchantEtaAddress: process.env.MERCHANT_ETA_ADDRESS!,
 *     network: "solana-devnet",
 *     rpcUrl: process.env.HELIUS_RPC_URL,
 *   });
 *
 *   const app = express();
 *   app.get("/article/:id", pay.charge({ amount: "10000" }), (req, res) => {
 *     res.json({ article: "hello world" });
 *   });
 *
 * The middleware returns 402 with a `PAYMENT-REQUIRED` header when no
 * payment is present, and on retry verifies the agent's `umbra-mixer-v1`
 * envelope on-chain via Solana RPC. No facilitator dependency: the queue
 * tx is the source of truth, and a successful queue tx is what authorizes
 * the response.
 *
 * Settlement is implicit. By the time the agent presents the envelope, the
 * encrypted-balance deduction has already landed on chain via Arcium MPC,
 * and a UTXO addressed to the merchant sits in the mixer tree. The
 * merchant's claim daemon picks that up asynchronously and credits the
 * encrypted balance — see scripts/umbra-claim-daemon.ts.
 */

export { payrail, type PayrailMerchantClient, type PaymentRequirements } from "./express.js";
export type { ChargeConfig, MerchantSdkConfig } from "./types.js";
