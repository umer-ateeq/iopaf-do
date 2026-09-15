-- Re-key copilotSettings on the auth provider's identifier.
--
-- 0001 keyed the row on users.id with a foreign key. That cannot hold on this
-- host: authenticateRequest deliberately serves a request from the verified
-- session claims when the users row is unavailable (commit 02ce637 moved that
-- write into a Supabase Edge Function so the Postgres password need not sit on
-- the application host), and substitutes a synthetic id of -1. Every caller
-- would therefore share one settings row, and the foreign key would reject the
-- insert outright.
--
-- openId comes from the session JWT this server signed and has already
-- verified, so it is always present and always unique to one user.
--
-- Safe to run more than once.

ALTER TABLE "copilotSettings"
  ADD COLUMN IF NOT EXISTS "openId" varchar(64);

--> statement-breakpoint

-- No row can be migrated: the userId form never persisted a row in any
-- environment, because saving failed before it could.
DELETE FROM "copilotSettings" WHERE "openId" IS NULL;

--> statement-breakpoint

ALTER TABLE "copilotSettings" ALTER COLUMN "openId" SET NOT NULL;

--> statement-breakpoint

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'copilotSettings_openId_unique'
  ) THEN
    ALTER TABLE "copilotSettings"
      ADD CONSTRAINT "copilotSettings_openId_unique" UNIQUE ("openId");
  END IF;
END
$do$;

--> statement-breakpoint

ALTER TABLE "copilotSettings" DROP COLUMN IF EXISTS "userId";
