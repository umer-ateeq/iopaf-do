-- Durable storage for assessment state.
--
-- Until now the engine's only store was localStorage: bound to one browser on
-- one machine, wiped by clearing site data, and capped at 5 MB — which a single
-- 3 MB evidence PDF nearly fills once base64-encoded.
--
-- Written by the browser directly through PostgREST using the signed-in user's
-- own JWT, never by the web host. That keeps the host holding only the
-- publishable key, as commit 02ce637 intended when it removed DATABASE_URL, and
-- makes Postgres itself the thing that enforces isolation: the policies below
-- are the only way in, and they compare every row to auth.uid().
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS "assessments" (
  "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Supabase's auth user, which is also what openId carries in the app session.
  "userId"    uuid NOT NULL REFERENCES auth.users("id") ON DELETE CASCADE,

  -- The engine holds one live assessment; a named slot leaves room for more
  -- without another migration.
  "slot"      text NOT NULL DEFAULT 'primary',

  -- The engine's own state document, stored whole so a restore is exact.
  "state"     jsonb NOT NULL,

  -- The engine's schema version (its `v` field) and its own autosave stamp.
  -- savedAt is what decides which copy is newer when a browser and the server
  -- disagree, so it is the engine's clock that arbitrates, not the database's.
  "stateVersion" integer NOT NULL,
  "savedAt"   timestamptz NOT NULL,

  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "assessments_user_slot_unique" UNIQUE ("userId", "slot"),

  -- Bound the document server-side. The client cannot talk its way past this,
  -- and an oversized write fails loudly instead of being truncated.
  CONSTRAINT "assessments_state_size" CHECK (octet_length("state"::text) <= 8388608)
);

--> statement-breakpoint

COMMENT ON TABLE "assessments" IS
  'Assessment state per user. Written by the browser under RLS with the user''s own JWT; the web host never touches it. 8 MB ceiling per document.';

--> statement-breakpoint

ALTER TABLE "assessments" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint

-- Four explicit policies rather than one FOR ALL, so each verb is auditable.
-- USING governs which existing rows are visible; WITH CHECK governs what may be
-- written, which is what stops a caller inserting a row owned by someone else.
DROP POLICY IF EXISTS "assessments_select_own" ON "assessments";
CREATE POLICY "assessments_select_own" ON "assessments"
  FOR SELECT TO authenticated
  USING ("userId" = auth.uid());

--> statement-breakpoint

DROP POLICY IF EXISTS "assessments_insert_own" ON "assessments";
CREATE POLICY "assessments_insert_own" ON "assessments"
  FOR INSERT TO authenticated
  WITH CHECK ("userId" = auth.uid());

--> statement-breakpoint

DROP POLICY IF EXISTS "assessments_update_own" ON "assessments";
CREATE POLICY "assessments_update_own" ON "assessments"
  FOR UPDATE TO authenticated
  USING ("userId" = auth.uid())
  WITH CHECK ("userId" = auth.uid());

--> statement-breakpoint

DROP POLICY IF EXISTS "assessments_delete_own" ON "assessments";
CREATE POLICY "assessments_delete_own" ON "assessments"
  FOR DELETE TO authenticated
  USING ("userId" = auth.uid());

--> statement-breakpoint

-- Reuses the hardened public.set_updated_at() that already backs users and
-- copilotSettings; see drizzle/0001 for why it is not redefined here.
DROP TRIGGER IF EXISTS "assessments_set_updated_at" ON "assessments";

--> statement-breakpoint

CREATE TRIGGER "assessments_set_updated_at"
  BEFORE UPDATE ON "assessments"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

--> statement-breakpoint

-- Restores read the newest row for the current user.
CREATE INDEX IF NOT EXISTS "assessments_user_saved_idx"
  ON "assessments" ("userId", "savedAt" DESC);
