-- Append-only history of assessment state.
--
-- assessments holds one row per user and slot, and a sync writes over it. That
-- is enough for "my laptop died" but not for "two devices edited the same
-- assessment": whichever saved last wins, and the work the loser had that the
-- winner never saw is gone with no trace. Reconciliation cannot detect that on
-- its own, because a stale device's document looks newer than what it replaces.
--
-- This table makes that unrecoverable case recoverable. Every distinct state
-- that reaches the database is retained, so a bad overwrite costs a restore,
-- not the work.
--
-- Written only by the trigger below, never by a client: there is a SELECT
-- policy and deliberately no INSERT, UPDATE or DELETE policy, so a caller can
-- read their own history and cannot rewrite it.
--
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS "assessmentRevisions" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "assessmentId" uuid NOT NULL REFERENCES "assessments"("id") ON DELETE CASCADE,
  -- Denormalised so an RLS check needs no join.
  "userId"       uuid NOT NULL REFERENCES auth.users("id") ON DELETE CASCADE,
  "state"        jsonb NOT NULL,
  "stateVersion" integer NOT NULL,
  "savedAt"      timestamptz NOT NULL,
  "recordedAt"   timestamptz NOT NULL DEFAULT now()
);

--> statement-breakpoint

COMMENT ON TABLE "assessmentRevisions" IS
  'Append-only history of assessment state. Written only by the trigger on assessments; clients may read their own rows and cannot modify any. Pruned to the newest REVISIONS_KEPT per assessment.';

--> statement-breakpoint

ALTER TABLE "assessmentRevisions" ENABLE ROW LEVEL SECURITY;

--> statement-breakpoint

DROP POLICY IF EXISTS "assessment_revisions_select_own" ON "assessmentRevisions";
CREATE POLICY "assessment_revisions_select_own" ON "assessmentRevisions"
  FOR SELECT TO authenticated
  USING ("userId" = auth.uid());

--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "assessment_revisions_lookup_idx"
  ON "assessmentRevisions" ("assessmentId", "savedAt" DESC);

--> statement-breakpoint

/**
 * Capture each new state and prune the tail.
 *
 * SECURITY DEFINER because the writer is this trigger, not the caller: the
 * table has no INSERT policy, which is what stops a client forging or erasing
 * its own history. search_path is pinned empty and every name below is fully
 * qualified, so nothing here resolves through a caller-controlled path.
 */
CREATE OR REPLACE FUNCTION public.record_assessment_revision()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $fn$
DECLARE
  revisions_kept constant integer := 10;
BEGIN
  -- An identical state is not a revision. Autosave fires on a timer, so
  -- without this the history would fill with copies of the same answers.
  IF TG_OP = 'UPDATE' AND NEW."state" = OLD."state" THEN
    RETURN NEW;
  END IF;

  INSERT INTO public."assessmentRevisions"
    ("assessmentId", "userId", "state", "stateVersion", "savedAt")
  VALUES (NEW."id", NEW."userId", NEW."state", NEW."stateVersion", NEW."savedAt");

  -- Keep the newest N for this assessment. Documents can approach 8 MB, so an
  -- unbounded history would grow without limit.
  DELETE FROM public."assessmentRevisions"
  WHERE "id" IN (
    SELECT "id" FROM public."assessmentRevisions"
    WHERE "assessmentId" = NEW."id"
    ORDER BY "recordedAt" DESC, "savedAt" DESC
    OFFSET revisions_kept
  );

  RETURN NEW;
END;
$fn$;

--> statement-breakpoint

DROP TRIGGER IF EXISTS "assessments_record_revision" ON "assessments";

--> statement-breakpoint

CREATE TRIGGER "assessments_record_revision"
  AFTER INSERT OR UPDATE OF "state" ON "assessments"
  FOR EACH ROW EXECUTE FUNCTION public.record_assessment_revision();

--> statement-breakpoint

-- Postgres grants EXECUTE to PUBLIC on a new function, which publishes this
-- one as /rest/v1/rpc/record_assessment_revision — a SECURITY DEFINER entry
-- point callable by anon. Supabase's own linter flags it, and it was flagged
-- on this project until revoked. The trigger is unaffected: it runs as the
-- table owner, not as whoever issued the statement.
REVOKE ALL ON FUNCTION public.record_assessment_revision() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_assessment_revision() FROM anon;
REVOKE ALL ON FUNCTION public.record_assessment_revision() FROM authenticated;

--> statement-breakpoint

-- Same reasoning for the shared updatedAt trigger function, which predates
-- this migration and carried the same default grant.
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM authenticated;
