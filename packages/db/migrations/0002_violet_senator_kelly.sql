DROP INDEX "merchants_owner_user_id_idx";--> statement-breakpoint
CREATE INDEX "transactions_counterparty_confirmed_idx" ON "transactions" USING btree ("counterparty","status","created_at" DESC NULLS LAST) WHERE "transactions"."kind" = 'spend';--> statement-breakpoint
CREATE UNIQUE INDEX "merchants_owner_user_id_idx" ON "merchants" USING btree ("owner_user_id");