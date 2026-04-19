// Payrail schema.
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
  "topup", // fiat in → USDG in agent wallet
  "spend", // USDG out → merchant
  "refund", // reverse of spend
  "payout", // merchant cash-out → bank (v2)
]);

export const txDirection = pgEnum("tx_direction", ["in", "out"]);

export const txStatus = pgEnum("tx_status", ["pending", "confirmed", "failed"]);

export const apiStatus = pgEnum("api_status", ["active", "paused"]);

export const webhookProvider = pgEnum("webhook_provider", [
  "dodo",
  "privy",
  "helius",
]);

// -----------------------------------------------------------------------------
// users — one row per Privy identity. `role` can be 'user' | 'merchant' | 'both'.
// -----------------------------------------------------------------------------

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    privyId: text("privy_id").notNull(),
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
    uniqueIndex("users_privy_id_idx").on(t.privyId),
    index("users_email_idx").on(t.email),
  ],
);

// -----------------------------------------------------------------------------
// agents — autonomous program owned by a user, with its own Privy Solana wallet.
// -----------------------------------------------------------------------------

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    privyWalletId: text("privy_wallet_id").notNull(),
    publicKey: text("public_key").notNull(), // Solana pubkey (base58)
    status: agentStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("agents_user_id_idx").on(t.userId),
    uniqueIndex("agents_public_key_idx").on(t.publicKey),
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
    // Running counter for current period. Reset by monthly cron.
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
    keyHash: text("key_hash").notNull(), // argon2/bcrypt hash
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
    // NULL while pending; set once confirmed.
    solanaSig: text("solana_sig"),
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
  ],
);

// -----------------------------------------------------------------------------
// merchants — API providers. Own a Privy-managed Solana payout wallet.
// -----------------------------------------------------------------------------

export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name"),
    payoutWallet: text("payout_wallet").notNull(), // Solana pubkey
    privyWalletId: text("privy_wallet_id").notNull(),
    dodoAccountId: text("dodo_account_id"), // nullable until cash-out onboarded
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("merchants_owner_user_id_idx").on(t.ownerUserId),
    uniqueIndex("merchants_payout_wallet_idx").on(t.payoutWallet),
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
// webhook_log — idempotency for incoming webhooks (dodo, privy, helius).
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
