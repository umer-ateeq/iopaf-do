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

-- Postgres has no ON UPDATE CURRENT_TIMESTAMP; a trigger maintains updatedAt.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

--> statement-breakpoint

DROP TRIGGER IF EXISTS "copilotSettings_set_updated_at" ON "copilotSettings";

--> statement-breakpoint

CREATE TRIGGER "copilotSettings_set_updated_at"
  BEFORE UPDATE ON "copilotSettings"
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
