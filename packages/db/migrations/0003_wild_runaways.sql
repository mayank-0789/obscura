ALTER TABLE "users" ADD COLUMN "onboarded_at" timestamp with time zone;--> statement-breakpoint
-- Backfill: anyone with a non-default role definitely picked it via the
-- onboarding screen, and anyone with a merchant row also did.
UPDATE "users" SET "onboarded_at" = "updated_at" WHERE "role" IN ('merchant', 'both');--> statement-breakpoint
UPDATE "users" SET "onboarded_at" = "updated_at" WHERE "id" IN (SELECT "owner_user_id" FROM "merchants") AND "onboarded_at" IS NULL;
