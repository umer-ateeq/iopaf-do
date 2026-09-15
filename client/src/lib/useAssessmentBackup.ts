import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import {
  ENGINE_STATE_KEY,
  syncOnce,
  type AssessmentState,
  type AssessmentTable,
  type RemoteRecord,
  type SyncStatus,
} from "@/lib/assessmentSync";

/**
 * Mirror the engine's assessment into Supabase, and bring it back on a new
 * browser.
 *
 * The engine autosaves into localStorage, and the portal shares that origin,
 * so this reads the same key the engine writes — the protected engine file is
 * not modified at all.
 *
 * Writes go straight from this browser to Postgres with the signed-in user's
 * own JWT, and the RLS policies in drizzle/0003_assessments.sql are what
 * enforce that a user can only ever touch their own row. The web host is not
 * in this path and never sees assessment data.
 */

const TABLE = "assessments";
const SLOT = "primary";
/** The engine debounces its own saves at 400 ms; this batches bursts of them. */
const SYNC_DEBOUNCE_MS = 4000;

export function createSupabaseAssessmentTable(
  client: SupabaseClient,
  userId: string
): AssessmentTable {
  return {
    async loadLatest() {
      const { data, error } = await client
        .from(TABLE)
        .select("state, savedAt, stateVersion")
        .eq("userId", userId)
        .eq("slot", SLOT)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) return null;
      return {
        state: data.state as AssessmentState,
        savedAt: data.savedAt as string,
        stateVersion: data.stateVersion as number,
      } satisfies RemoteRecord;
    },

    async save(state, savedAt, stateVersion, expectedSavedAt) {
      // userId is sent explicitly and RLS checks it against auth.uid(), so a
      // tampered value is rejected by Postgres rather than trusted here.
      const row = { userId, slot: SLOT, state, savedAt, stateVersion };

      if (expectedSavedAt === null) {
        // No row was seen, so this must create one. A unique violation means
        // another device inserted first — a conflict, not a failure.
        const { error } = await client.from(TABLE).insert(row);
        if (!error) return "applied";
        if (error.code === "23505") return "conflict";
        throw new Error(error.message);
      }

      // Conditional on the savedAt that was read. If another device has
      // written since, this matches nothing and no data is destroyed.
      const { data, error } = await client
        .from(TABLE)
        .update(row)
        .eq("userId", userId)
        .eq("slot", SLOT)
        .eq("savedAt", expectedSavedAt)
        .select("id");

      if (error) throw new Error(error.message);
      return data && data.length > 0 ? "applied" : "conflict";
    },
  };
}

export type UseAssessmentBackup = {
  status: SyncStatus;
  /** True once a restore has replaced local state, so the engine must reload. */
  needsEngineReload: boolean;
  acknowledgeReload: () => void;
  syncNow: () => void;
};

export function useAssessmentBackup(enabled: boolean): UseAssessmentBackup {
  const [status, setStatus] = useState<SyncStatus>({ state: "idle" });
  const [needsEngineReload, setNeedsEngineReload] = useState(false);
  const tableRef = useRef<AssessmentTable | null>(null);
  const timerRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const pendingRef = useRef(false);

  const run = useCallback(async (isInitial: boolean) => {
    const table = tableRef.current;
    if (!table) return;

    // Never overlap: a second pass mid-flight could read a half-written
    // document. Coalesce instead.
    if (runningRef.current) {
      pendingRef.current = true;
      return;
    }
    runningRef.current = true;
    try {
      const result = await syncOnce({
        storage: window.localStorage,
        table,
        onStatus: setStatus,
      });
      // A restore rewrites localStorage, but the engine read its state at boot
      // and will not notice. Only ask for a reload on the first pass, before
      // the user can have typed anything into the running engine.
      if (result.action === "restore" && isInitial) setNeedsEngineReload(true);
    } finally {
      runningRef.current = false;
      if (pendingRef.current) {
        pendingRef.current = false;
        void run(false);
      }
    }
  }, []);

  const schedule = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => void run(false), SYNC_DEBOUNCE_MS);
  }, [run]);

  const syncNow = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    void run(false);
  }, [run]);

  useEffect(() => {
    if (!enabled || !supabaseConfigured) return;

    let cancelled = false;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const userId = data.user?.id;
      if (!userId || cancelled) return;
      tableRef.current = createSupabaseAssessmentTable(supabase, userId);
      await run(true);
    })();

    // The engine writes from the iframe; a same-origin storage event is how
    // this document hears about it, with no change to the engine itself.
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === ENGINE_STATE_KEY) schedule();
    };
    // Last chance to flush before the tab goes away.
    const onHide = () => {
      if (document.visibilityState === "hidden") syncNow();
    };

    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onHide);

    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onHide);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [enabled, run, schedule, syncNow]);

  const acknowledgeReload = useCallback(() => setNeedsEngineReload(false), []);

  return { status, needsEngineReload, acknowledgeReload, syncNow };
}
