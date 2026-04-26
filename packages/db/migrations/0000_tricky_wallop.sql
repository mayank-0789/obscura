CREATE TYPE "public"."agent_status" AS ENUM('active', 'paused', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."api_status" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TYPE "public"."budget_period" AS ENUM('monthly', 'daily');--> statement-breakpoint
CREATE TYPE "public"."tx_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."tx_kind" AS ENUM('topup', 'spend', 'refund', 'payout');--> statement-breakpoint
CREATE TYPE "public"."tx_status" AS ENUM('pending', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."umbra_account_status" AS ENUM('active', 'deregistered');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'merchant', 'both');--> statement-breakpoint
CREATE TYPE "public"."webhook_provider" AS ENUM('dodo', 'helius');--> statement-breakpoint
CREATE TABLE "agent_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"label" text,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"eta_address" text NOT NULL,
	"status" "agent_status" DEFAULT 'active' NOT NULL,
	"umbra_status" "umbra_account_status",
	"umbra_registered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"period" "budget_period" DEFAULT 'monthly' NOT NULL,
	"cap_inr" bigint DEFAULT 0 NOT NULL,
	"cap_usdg" bigint DEFAULT 0 NOT NULL,
	"spent_usdg" bigint DEFAULT 0 NOT NULL,
	"period_start" timestamp with time zone DEFAULT now() NOT NULL,
	"merchant_allowlist" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"label" text,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_apis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"endpoint" text NOT NULL,
	"default_price_usdg" bigint NOT NULL,
	"status" "api_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text,
	"eta_address" text NOT NULL,
	"dodo_account_id" text,
	"umbra_status" "umbra_account_status",
	"umbra_registered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"kind" "tx_kind" NOT NULL,
	"direction" "tx_direction" NOT NULL,
	"amount_usdg" bigint NOT NULL,
	"amount_inr" bigint,
	"rate_snapshot" numeric(10, 4),
	"counterparty" text NOT NULL,
	"merchant_host" text,
	"solana_sig" text,
	"queue_signature" text,
	"callback_signature" text,
	"callback_status" text,
	"dodo_payment_id" text,
	"status" "tx_status" DEFAULT 'pending' NOT NULL,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_id" text NOT NULL,
	"email" text,
	"phone" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "webhook_provider" NOT NULL,
	"event_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "x402_nonces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nonce" text NOT NULL,
	"merchant_api_id" uuid,
	"agent_id" uuid,
	"consumed" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_api_keys" ADD CONSTRAINT "agent_api_keys_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_api_keys" ADD CONSTRAINT "merchant_api_keys_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_apis" ADD CONSTRAINT "merchant_apis_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x402_nonces" ADD CONSTRAINT "x402_nonces_merchant_api_id_merchant_apis_id_fk" FOREIGN KEY ("merchant_api_id") REFERENCES "public"."merchant_apis"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "x402_nonces" ADD CONSTRAINT "x402_nonces_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_api_keys_agent_id_idx" ON "agent_api_keys" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agents_user_id_idx" ON "agents" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "agents_eta_address_idx" ON "agents" USING btree ("eta_address");--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_agent_id_idx" ON "budgets" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "merchant_api_keys_merchant_id_idx" ON "merchant_api_keys" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "merchant_apis_merchant_id_idx" ON "merchant_apis" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_owner_user_id_idx" ON "merchants" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_eta_address_idx" ON "merchants" USING btree ("eta_address");--> statement-breakpoint
CREATE INDEX "transactions_agent_id_created_at_idx" ON "transactions" USING btree ("agent_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_solana_sig_idx" ON "transactions" USING btree ("solana_sig");--> statement-breakpoint
CREATE INDEX "transactions_dodo_payment_id_idx" ON "transactions" USING btree ("dodo_payment_id");--> statement-breakpoint
CREATE INDEX "transactions_counterparty_confirmed_idx" ON "transactions" USING btree ("counterparty","status","created_at" DESC NULLS LAST) WHERE "transactions"."kind" = 'spend';--> statement-breakpoint
CREATE UNIQUE INDEX "users_auth_id_idx" ON "users" USING btree ("auth_id");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_log_provider_event_idx" ON "webhook_log" USING btree ("provider","event_id");--> statement-breakpoint
CREATE INDEX "webhook_log_unprocessed_idx" ON "webhook_log" USING btree ("processed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "x402_nonces_nonce_idx" ON "x402_nonces" USING btree ("nonce");--> statement-breakpoint
CREATE INDEX "x402_nonces_expires_at_idx" ON "x402_nonces" USING btree ("expires_at");