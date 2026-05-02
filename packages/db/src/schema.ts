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

export const userRole = pgEnum("user_role", ["user", "merchant", "both"]);

export const agentStatus = pgEnum("agent_status", [
  "active",
  "paused",
  "cancelled",
]);

export const budgetPeriod = pgEnum("budget_period", ["monthly", "daily"]);

export const txKind = pgEnum("tx_kind", [
  "topup",
  "spend",
  "refund",
  "payout",
]);

export const txDirection = pgEnum("tx_direction", ["in", "out"]);

export const txStatus = pgEnum("tx_status", ["pending", "confirmed", "failed"]);

export const apiStatus = pgEnum("api_status", ["active", "paused"]);

export const webhookProvider = pgEnum("webhook_provider", [
  "dodo",
  "helius",
]);

// Reserved 'deregistered' for forward-compat (Umbra protocol supports it but doesn't expose today).
export const umbraAccountStatus = pgEnum("umbra_account_status", [
  "active",
  "deregistered",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Google `sub` from NextAuth session, indexed unique.
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

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Solana pubkey of the agent's Umbra-side keypair (derived server-side via HMAC).
    etaAddress: text("eta_address").notNull(),
    status: agentStatus("status").notNull().default("active"),
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

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    period: budgetPeriod("period").notNull().default("monthly"),
    capInr: bigint("cap_inr", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    capUsdg: bigint("cap_usdg", { mode: "bigint" })
      .notNull()
      .default(sql`0`),
    // Lazy reset inside x402/sign cap-check path (no cron).
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

export const agentApiKeys = pgTable(
  "agent_api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    keyHash: text("key_hash").notNull(),
    label: text("label"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("agent_api_keys_agent_id_idx").on(t.agentId)],
);

// Solana tx is source of truth, this is a materialized view; daily reconciliation.
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
    amountInr: bigint("amount_inr", { mode: "bigint" }),
    rateSnapshot: numeric("rate_snapshot", { precision: 10, scale: 4 }),
    counterparty: text("counterparty").notNull(),
    merchantHost: text("merchant_host"),
    solanaSig: text("solana_sig"),
    queueSignature: text("queue_signature"),
    callbackSignature: text("callback_signature"),
    // 'finalized' | 'pruned' | 'timed_out'. Only 'finalized' is success;
    // pruned/timed_out are uncertain — verify on-chain before retry.
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
    // Multiple NULLs allowed (pending txs).
    uniqueIndex("transactions_solana_sig_idx").on(t.solanaSig),
    // Closes concurrent-retry double-credit race in Dodo webhook: unique index
    // ensures only one pending-tx INSERT survives so deposit can't fire twice.
    uniqueIndex("transactions_dodo_payment_id_idx").on(t.dodoPaymentId),
    // Partial index for merchant earnings queries.
    index("transactions_counterparty_confirmed_idx")
      .on(t.counterparty, t.status, t.createdAt.desc())
      .where(sql`${t.kind} = 'spend'`),
  ],
);

export const merchants = pgTable(
  "merchants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name"),
    // Where agents pay merchants via ETA→ETA mixer.
    etaAddress: text("eta_address").notNull(),
    dodoAccountId: text("dodo_account_id"),
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
    // Enforces 1:1 at DB level so a double-POST race on /api/merchants
    // can't produce two rows; losing INSERT trips ON CONFLICT.
    uniqueIndex("merchants_owner_user_id_idx").on(t.ownerUserId),
    uniqueIndex("merchants_eta_address_idx").on(t.etaAddress),
  ],
);

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
  (t) => [
    index("merchant_apis_merchant_id_idx").on(t.merchantId),
    // Closes read-then-write TOCTOU window in the POST route.
    uniqueIndex("merchant_apis_merchant_id_endpoint_idx").on(
      t.merchantId,
      t.endpoint,
    ),
  ],
);

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
    // Second delivery of same event is no-op.
    uniqueIndex("webhook_log_provider_event_idx").on(t.provider, t.eventId),
    index("webhook_log_unprocessed_idx").on(t.processedAt),
  ],
);

// Replay protection for x402 payments; TTL cleanup cron drops expired hourly.
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
