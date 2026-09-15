-- AI Copilot per-user preferences (Postgres / Supabase).
--
-- Hand-authored rather than drizzle-kit generated: drizzle/0000 and
-- drizzle/meta/_journal.json are still the original MySQL artefacts from
-- before the Postgres port, so `drizzle-kit generate` cannot be trusted to
-- produce a correct incremental diff here. Apply this file directly.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS "copilotSettings" (
  "id"                     integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "userId"                 integer NOT NULL UNIQUE
                             REFERENCES "users"("id") ON DELETE CASCADE,
  "enabled"                boolean NOT NULL DEFAULT true,
  "model"                  varchar(255) NOT NULL DEFAULT 'gpt-4o-mini',
  "includeCurrentResponse" boolean NOT NULL DEFAULT false,
  "includeRemediation"     boolean NOT NULL DEFAULT false,
  "createdAt"              timestamptz NOT NULL DEFAULT now(),
  "updatedAt"              timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

COMMENT ON TABLE "copilotSettings" IS
  'Per-user AI Copilot preferences. Server-only: RLS enabled with no policies '
  'so PostgREST clients cannot read it. Holds no provider credential.';

--> statement-breakpoint

-- Match the users table: reachable only through the server's own connection,
-- never through the PostgREST API with a publishable key.
ALTER TABLE "copilotSettings" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint

-- Postgres has no ON UPDATE CURRENT_TIMESTAMP; a trigger maintains updatedAt.
--
-- public.set_updated_at() already exists in the deployed database, where it
-- backs the users table trigger, and it is hardened with SET search_path TO ''.
-- CREATE OR REPLACE would overwrite that hardening, so create it only when it
-- is genuinely absent (a fresh environment) and otherwise reuse it as-is.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'set_updated_at'
  ) THEN
    CREATE FUNCTION public.set_updated_at() RETURNS trigger
      LANGUAGE plpgsql
      SET search_path TO ''
      AS $fn$
        BEGIN
          NEW."updatedAt" = clock_timestamp();
          RETURN NEW;
        END;
      $fn$;
  END IF;
END
$do$;

--> statement-breakpoint

DROP TRIGGER IF EXISTS "copilotSettings_set_updated_at" ON "copilotSettings";

--> statement-breakpoint

CREATE TRIGGER "copilotSettings_set_updated_at"
  BEFORE UPDATE ON "copilotSettings"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
