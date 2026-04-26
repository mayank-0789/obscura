// Payrail schema (post-Umbra pivot).
// Conventions: UUIDs (pg defaultRandom), timestamptz, bigint for money.
// USDG base units: $1 = 1_000_000 (6 decimals). INR paise: ₹1 = 100.
// Soft deletes via status / revoked_at — avoid hard DELETEs.

import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  jsonb,
  boolean,
  numeric,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// -----------------------------------------------------------------------------
// Enums
// -----------------------------------------------------------------------------

export const userRole = pgEnum("user_role", ["user", "merchant", "both"]);

export const agentStatus = pgEnum("agent_status", [
  "active",
  "paused",
  "cancelled",
]);

export const budgetPeriod = pgEnum("budget_period", ["monthly", "daily"]);

export const txKind = pgEnum("tx_kind", [
  "topup", // fiat in → encrypted balance
  "spend", // encrypted balance out → merchant
  "refund", // reverse of spend
  "payout", // merchant cash-out → bank (v2)
]);

export const txDirection = pgEnum("tx_direction", ["in", "out"]);

export const txStatus = pgEnum("tx_status", ["pending", "confirmed", "failed"]);

export const apiStatus = pgEnum("api_status", ["active", "paused"]);

export const webhookProvider = pgEnum("webhook_provider", [
  "dodo",
  "helius",
]);

// Umbra-side state for an account (agent or merchant). NULL = not yet
// registered on Umbra. Once registered, transitions to 'active'. Reserved
// 'deregistered' for forward-compat (Umbra doesn't expose deregistration today
// but the protocol supports it).
export const umbraAccountStatus = pgEnum("umbra_account_status", [
  "active",
  "deregistered",
]);

// -----------------------------------------------------------------------------
// users — one row per authenticated Google identity. `role` can be 'user' |
// 'merchant' | 'both'.
// -----------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Stable per-user identifier from the auth provider (Google `sub` today,
    // surfaced via NextAuth session). Indexed unique.
    authId: text("auth_id").notNull(),
    email: text("email"),
    phone: text("phone"),
    role: userRole("role").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_auth_id_idx").on(t.authId),
    index("users_email_idx").on(t.email),
  ],
);

// -----------------------------------------------------------------------------
// agents — autonomous program owned by a user. Has a server-derived Umbra
// keypair (HMAC over UMBRA_AGENT_SEED_SECRET + agent.id) registered on Umbra
// at creation time. `eta_address` is the L1 Solana pubkey for that keypair.
// -----------------------------------------------------------------------------

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Solana pubkey (base58) of the agent's Umbra-side keypair. The encrypted
    // token account (ETA) is a PDA derived from this address + the mint.
    etaAddress: text("eta_address").notNull(),
    status: agentStatus("status").notNull().default("active"),
    // Umbra-side registration state. NULL until first registration succeeds.
    umbraStatus: umbraAccountStatus("umbra_status"),
    umbraRegisteredAt: timestamp("umbra_registered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("agents_user_id_idx").on(t.userId),
    uniqueIndex("agents_eta_address_idx").on(t.etaAddress),
  ],
);

// -----------------------------------------------------------------------------
// budgets — spend policy per agent (1:1, enforced via unique index).
// -----------------------------------------------------------------------------

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    period: budgetPeriod("period").notNull().default("monthly"),
    // Source of truth (user-set INR, paise).
    capInr: bigint("cap_inr", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    // USDG equivalent at set time (base units, 6 decimals).
    capUsdg: bigint("cap_usdg", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    // Running counter for the current period. Reset lazily inside the x402
    // cap-check path (apps/web/app/api/x402/sign/route.ts) — no cron: if the
    // period has elapsed when the next sign arrives, spentUsdg is zeroed and
    // periodStart advanced in the same transaction as the cap check.
    spentUsdg: bigint("spent_usdg", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    periodStart: timestamp("period_start", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Optional allowlist of merchant IDs/addresses (jsonb array).
    merchantAllowlist: jsonb("merchant_allowlist"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("budgets_agent_id_idx").on(t.agentId)],
);

// -----------------------------------------------------------------------------
// agent_api_keys — multiple per agent (rotation / audit). Plaintext shown once.
// -----------------------------------------------------------------------------

export const agentApiKeys = pgTable(
  "agent_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    keyHash: text("key_hash").notNull(), // SHA-256 of pk_<28-char nanoid>
    label: text("label"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("agent_api_keys_agent_id_idx").on(t.agentId)],
);

// -----------------------------------------------------------------------------
// transactions — every money event. Solana tx is source of truth; this is a
// materialized view. Daily reconciliation cron ensures on-chain ↔ DB parity.
//
// Umbra ops use the queue+callback pattern: queueSignature is the tx that
// asks the Arcium MPC to compute, callbackSignature is the canonical "result
// landed on-chain" tx (only `callbackStatus = 'finalized'` is success).
// solanaSig stays for plain SPL paths (treasury fund-up etc.).
// -----------------------------------------------------------------------------

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    kind: txKind("kind").notNull(),
    direction: txDirection("direction").notNull(),
    amountUsdg: bigint("amount_usdg", { mode: "bigint" }).notNull(),
    // Only populated for topup / payout.
    amountInr: bigint("amount_inr", { mode: "bigint" }),
    // FX rate locked at topup/payout time (INR per 1 USD). NULL for spends.
    rateSnapshot: numeric("rate_snapshot", { precision: 10, scale: 4 }),
    // Merchant pubkey, literal "TREASURY", or "USER_BANK" sentinel.
    counterparty: text("counterparty").notNull(),
    // Host of the paid resource for kind='spend' (e.g. "news.example.com").
    // NULL for topups/payouts. Populated from the x402 `resource.url`.
    merchantHost: text("merchant_host"),
    // Plain SPL signature (legacy / non-Umbra paths). For Umbra ops we mirror
    // callbackSignature here once it finalizes, so consumers that key on
    // solanaSig keep working.
    solanaSig: text("solana_sig"),
    // Umbra MPC queue signature — proves we asked. Set BEFORE callback lands.
    queueSignature: text("queue_signature"),
    // Umbra MPC callback signature — proves the encrypted-state update landed.
    callbackSignature: text("callback_signature"),
    // 'finalized' | 'pruned' | 'timed_out' (from Arcium). Only 'finalized' is
    // success; pruned/timed_out are uncertain — verify on-chain before retry.
    callbackStatus: text("callback_status"),
    dodoPaymentId: text("dodo_payment_id"),
    status: txStatus("status").notNull().default("pending"),
    memo: text("memo"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => [
    index("transactions_agent_id_created_at_idx").on(t.agentId, t.createdAt),
    // Unique on solana_sig — multiple NULLs allowed (pending txs).
    uniqueIndex("transactions_solana_sig_idx").on(t.solanaSig),
    index("transactions_dodo_payment_id_idx").on(t.dodoPaymentId),
    // Partial index for merchant earnings queries.
    index("transactions_counterparty_confirmed_idx")
      .on(t.counterparty, t.status, t.createdAt.desc())
      .where(sql`${t.kind} = 'spend'`),
  ],
);

// -----------------------------------------------------------------------------
// merchants — API providers. Have a server-derived Umbra keypair registered on
// Umbra at signup time. `eta_address` is where agents pay them (via ETA→ETA
// confidential transfer in the x402 hot path).
// -----------------------------------------------------------------------------

export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name"),
    // Solana pubkey of the merchant's Umbra-side keypair.
    etaAddress: text("eta_address").notNull(),
    dodoAccountId: text("dodo_account_id"), // nullable until cash-out onboarded
    // Umbra-side registration state. NULL until first registration succeeds.
    umbraStatus: umbraAccountStatus("umbra_status"),
    umbraRegisteredAt: timestamp("umbra_registered_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Unique — one merchant per user. Enforces 1:1 at the DB level so a
    // double-POST race on /api/merchants can't produce two rows; the losing
    // INSERT trips ON CONFLICT and we re-read the winner.
    uniqueIndex("merchants_owner_user_id_idx").on(t.ownerUserId),
    uniqueIndex("merchants_eta_address_idx").on(t.etaAddress),
  ],
);

// -----------------------------------------------------------------------------
// merchant_api_keys — same pattern as agent_api_keys.
// -----------------------------------------------------------------------------

export const merchantApiKeys = pgTable(
  "merchant_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    keyHash: text("key_hash").notNull(),
    label: text("label"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("merchant_api_keys_merchant_id_idx").on(t.merchantId)],
);

// -----------------------------------------------------------------------------
// merchant_apis — specific registered paid endpoints per merchant.
// -----------------------------------------------------------------------------

export const merchantApis = pgTable(
  "merchant_apis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    endpoint: text("endpoint").notNull(),
    defaultPriceUsdg: bigint("default_price_usdg", {
      mode: "bigint",
    }).notNull(),
    status: apiStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("merchant_apis_merchant_id_idx").on(t.merchantId)],
);

// -----------------------------------------------------------------------------
// webhook_log — idempotency for incoming webhooks (dodo, helius).
// UNIQUE (provider, event_id) — second delivery of same event is a no-op.
// -----------------------------------------------------------------------------

export const webhookLog = pgTable(
  "webhook_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: webhookProvider("provider").notNull(),
    eventId: text("event_id").notNull(),
    payload: jsonb("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("webhook_log_provider_event_idx").on(t.provider, t.eventId),
    index("webhook_log_unprocessed_idx").on(t.processedAt),
  ],
);

// -----------------------------------------------------------------------------
// x402_nonces — replay protection for x402 payments. TTL cleanup cron drops
// expired rows hourly.
// -----------------------------------------------------------------------------

export const x402Nonces = pgTable(
  "x402_nonces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nonce: text("nonce").notNull(),
    merchantApiId: uuid("merchant_api_id").references(
      () => merchantApis.id,
      { onDelete: "set null" },
    ),
    agentId: uuid("agent_id").references(() => agents.id, {
      onDelete: "set null",
    }),
    consumed: boolean("consumed").notNull().default(false),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("x402_nonces_nonce_idx").on(t.nonce),
    index("x402_nonces_expires_at_idx").on(t.expiresAt),
  ],
);

// -----------------------------------------------------------------------------
// Type exports (inferred from schema).
// -----------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;

export type AgentApiKey = typeof agentApiKeys.$inferSelect;
export type NewAgentApiKey = typeof agentApiKeys.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;

export type MerchantApiKey = typeof merchantApiKeys.$inferSelect;
export type NewMerchantApiKey = typeof merchantApiKeys.$inferInsert;

export type MerchantApi = typeof merchantApis.$inferSelect;
export type NewMerchantApi = typeof merchantApis.$inferInsert;

export type WebhookLog = typeof webhookLog.$inferSelect;
export type NewWebhookLog = typeof webhookLog.$inferInsert;

export type X402Nonce = typeof x402Nonces.$inferSelect;
export type NewX402Nonce = typeof x402Nonces.$inferInsert;
