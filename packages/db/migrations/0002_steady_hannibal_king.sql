DROP INDEX "transactions_dodo_payment_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_dodo_payment_id_idx" ON "transactions" USING btree ("dodo_payment_id");