/**
 * @payrail-app/merchant-sdk — Express-style middleware for API sellers who want
 * to accept x402 payments on Solana.
 *
 *   npm install @payrail-app/merchant-sdk
 *
 *   import express from "express";
 *   import { payrail } from "@payrail-app/merchant-sdk";
 *
 *   const pay = payrail({
 *     payoutWallet: process.env.PAYOUT_WALLET!,
 *     network: "solana-devnet",
 *   });
 *
 *   const app = express();
 *   app.get("/article/:id", pay.charge({ amount: "10000" }), (req, res) => {
 *     res.json({ article: "hello world" });
 *   });
 *
 * The middleware wraps PayAI's facilitator. It returns 402 with a valid
 * PAYMENT-REQUIRED header when no payment is present, verifies + settles
 * the payment on-chain via `/verify` + `/settle`, and calls your handler
 * only after settlement succeeds.
 */

export { payrail, type PayrailMerchantClient, type PaymentRequirements } from "./express.js";
export type { ChargeConfig, MerchantSdkConfig } from "./types.js";
