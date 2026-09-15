/**
 * Durable backup of the assessment engine's state.
 *
 * The engine autosaves into localStorage under a single key. That is bound to
 * one browser on one machine, is wiped by clearing site data, and is capped at
 * 5 MB. This module mirrors that document into Supabase so an assessment
 * survives the device.
 *
 * The browser writes it directly under RLS with the signed-in user's own JWT;
 * the web host never sees assessment data. Postgres enforces the isolation —
 * see drizzle/0003_assessments.sql.
 *
 * Everything that decides whether data is written or replaced lives in the pure
 * functions below, because that is where work gets lost. The default is always
 * to keep what exists: a replaced local document is copied aside first, and an
 * empty local document never overwrites a populated remote one.
 */

export const ENGINE_STATE_KEY = "iopaf-v4-state";
/** A local document is copied here before a remote one replaces it. */
export const REPLACED_BACKUP_KEY = "iopaf-v4-state.replaced";
/** Matches the CHECK constraint on assessments.state. */
export const MAX_STATE_BYTES = 8 * 1024 * 1024;

export type AssessmentState = {
  v?: number;
  savedAt?: string;
  answers?: Record<string, unknown>;
  iamObjResponses?: Record<string, unknown>;
  iamR?: Record<string, unknown>;
  notes?: Record<string, unknown>;
  [key: string]: unknown;
};

export type RemoteRecord = {
  state: AssessmentState;
  savedAt: string;
  stateVersion: number;
};

/** Minimal storage surface, so tests need no DOM. */
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function parseState(raw: string | null): AssessmentState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as AssessmentState;
  } catch {
    return null;
  }
}

/**
 * Does this document contain assessment work?
 *
 * The engine writes a skeleton document on first load, before anything has
 * been answered. Treating that as content would let a fresh browser overwrite
 * a populated backup with nothing, which is the one failure that loses work
 * irrecoverably.
 */
export function hasContent(state: AssessmentState | null): boolean {
  if (!state) return false;
  const populated = (value: unknown) =>
    Boolean(value && typeof value === "object" && Object.keys(value as object).length > 0);
  return (
    populated(state.answers) ||
    populated(state.iamObjResponses) ||
    populated(state.iamR) ||
    populated(state.notes)
  );
}

export function savedAtMs(state: AssessmentState | null | undefined): number {
  const value = state?.savedAt;
  if (typeof value !== "string") return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

export type Reconciliation =
  | { action: "push"; reason: string }
  | { action: "restore"; reason: string }
  | { action: "none"; reason: string };

/**
 * Decide what to do when a browser and the server both hold a document.
 *
 * Newer `savedAt` wins, because that is the engine's own clock and the only
 * timestamp that reflects when a human last changed something. Ties do
 * nothing. An empty local document never wins against a populated remote one
 * however new it looks, and a populated local document is never discarded in
 * favour of an empty remote one.
 */
export function reconcile(
  local: AssessmentState | null,
  remote: RemoteRecord | null
): Reconciliation {
  const localHas = hasContent(local);
  const remoteHas = hasContent(remote?.state ?? null);

  if (!localHas && !remoteHas) return { action: "none", reason: "nothing to sync yet" };
  if (localHas && !remoteHas) return { action: "push", reason: "no backup exists yet" };
  if (!localHas && remoteHas) return { action: "restore", reason: "this browser has no assessment" };

  const localMs = savedAtMs(local);
  const remoteMs = savedAtMs(remote?.state);

  if (localMs > remoteMs) return { action: "push", reason: "this browser is newer" };
  if (remoteMs > localMs) return { action: "restore", reason: "the backup is newer" };
  return { action: "none", reason: "already in step" };
}

export type SizeCheck = { ok: boolean; bytes: number; limit: number };

export function checkSize(state: AssessmentState): SizeCheck {
  // Matches how Postgres measures the jsonb text, so the client refuses
  // before the database does and can say something useful about it.
  const bytes = new TextEncoder().encode(JSON.stringify(state)).length;
  return { ok: bytes <= MAX_STATE_BYTES, bytes, limit: MAX_STATE_BYTES };
}

/**
 * Write a remote document into local storage, keeping whatever was there.
 *
 * The displaced copy stays under REPLACED_BACKUP_KEY so a restore is never a
 * one-way door: if the wrong document won, the previous one is still on disk.
 */
export function applyRestore(storage: StorageLike, remote: RemoteRecord): void {
  const existing = storage.getItem(ENGINE_STATE_KEY);
  if (existing) {
    try {
      storage.setItem(REPLACED_BACKUP_KEY, existing);
    } catch {
      // A full quota must not prevent the restore itself.
    }
  }
  storage.setItem(ENGINE_STATE_KEY, JSON.stringify(remote.state));
}

export type SyncStatus =
  | { state: "idle" }
  | { state: "syncing" }
  | { state: "saved"; at: string }
  | { state: "restored"; at: string }
  | { state: "too-large"; bytes: number; limit: number }
  | { state: "conflict" }
  | { state: "error"; message: string };

/**
 * Outcome of a conditional write. "conflict" means the stored document moved
 * between reading it and writing, so this document is no longer a safe
 * replacement for it.
 */
export type SaveOutcome = "applied" | "conflict";

/** The subset of the Supabase client this module uses. */
export type AssessmentTable = {
  loadLatest(): Promise<RemoteRecord | null>;
  /**
   * Write the document, but only if the stored one is still what was read.
   * `expectedSavedAt` is the savedAt observed a moment ago, or null when no
   * row was seen at all. Implementations must not overwrite unconditionally:
   * that is what silently destroys another device's work.
   */
  save(
    state: AssessmentState,
    savedAt: string,
    stateVersion: number,
    expectedSavedAt: string | null
  ): Promise<SaveOutcome>;
};

export type SyncDeps = {
  storage: StorageLike;
  table: AssessmentTable;
  onStatus?: (status: SyncStatus) => void;
};

/**
 * Run one reconciliation pass. Returns what it did, so a caller can report it.
 */
export async function syncOnce(deps: SyncDeps, attempt = 0): Promise<Reconciliation> {
  const { storage, table, onStatus } = deps;
  const local = parseState(storage.getItem(ENGINE_STATE_KEY));

  let remote: RemoteRecord | null = null;
  try {
    remote = await table.loadLatest();
  } catch (error) {
    onStatus?.({
      state: "error",
      message: error instanceof Error ? error.message : "Could not reach the backup",
    });
    return { action: "none", reason: "backup unreachable" };
  }

  const decision = reconcile(local, remote);

  if (decision.action === "push" && local) {
    const size = checkSize(local);
    if (!size.ok) {
      onStatus?.({ state: "too-large", bytes: size.bytes, limit: size.limit });
      return { action: "none", reason: "document exceeds the backup limit" };
    }
    onStatus?.({ state: "syncing" });
    try {
      const outcome = await table.save(
        local,
        typeof local.savedAt === "string" ? local.savedAt : new Date().toISOString(),
        typeof local.v === "number" ? local.v : 0,
        remote?.savedAt ?? null
      );

      if (outcome === "conflict") {
        // Another device wrote between the read and the write, so this
        // document is no longer a safe replacement. Re-read and decide again
        // rather than forcing it. One retry only: a document that keeps
        // losing the race is being actively edited elsewhere, and the right
        // answer then is to leave it alone.
        if (attempt === 0) return syncOnce(deps, attempt + 1);
        onStatus?.({ state: "conflict" });
        return { action: "none", reason: "the backup is being written elsewhere" };
      }

      onStatus?.({ state: "saved", at: new Date().toISOString() });
    } catch (error) {
      onStatus?.({
        state: "error",
        message: error instanceof Error ? error.message : "Backup failed",
      });
      return { action: "none", reason: "save failed" };
    }
    return decision;
  }

  if (decision.action === "restore" && remote) {
    applyRestore(storage, remote);
    onStatus?.({ state: "restored", at: new Date().toISOString() });
    return decision;
  }

  return decision;
}
