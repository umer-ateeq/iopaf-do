import { describe, expect, it, vi } from "vitest";
import {
  applyRestore,
  checkSize,
  ENGINE_STATE_KEY,
  hasContent,
  MAX_STATE_BYTES,
  parseState,
  reconcile,
  REPLACED_BACKUP_KEY,
  savedAtMs,
  syncOnce,
  type AssessmentState,
  type RemoteRecord,
  type StorageLike,
} from "./assessmentSync";

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map(Object.entries(seed));
  const storage: StorageLike & { dump(): Record<string, string>; failWrites?: boolean } = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      if (storage.failWrites) throw new Error("QuotaExceededError");
      map.set(k, v);
    },
    removeItem: (k: string) => void map.delete(k),
    dump: () => Object.fromEntries(map),
  };
  return storage;
}

const withAnswers = (savedAt: string, answers = { "RD-1-g": 3 }): AssessmentState => ({
  v: 9,
  savedAt,
  answers,
});

/** What the engine writes on a first load, before anything is answered. */
const skeleton = (savedAt: string): AssessmentState => ({
  v: 9,
  savedAt,
  answers: {},
  notes: {},
  iamR: {},
});

const remoteOf = (state: AssessmentState): RemoteRecord => ({
  state,
  savedAt: String(state.savedAt),
  stateVersion: Number(state.v ?? 0),
});

describe("parseState", () => {
  it("returns null for missing or unusable input", () => {
    expect(parseState(null)).toBeNull();
    expect(parseState("")).toBeNull();
    expect(parseState("{not json")).toBeNull();
    expect(parseState("[1,2,3]")).toBeNull();
    expect(parseState("null")).toBeNull();
    expect(parseState('"a string"')).toBeNull();
  });

  it("parses a real engine document", () => {
    expect(parseState(JSON.stringify(withAnswers("2026-09-15T10:00:00Z")))?.v).toBe(9);
  });
});

describe("hasContent", () => {
  it("treats a first-load skeleton as empty", () => {
    // The document exists and has a fresh timestamp, but holds no work. This
    // is the case that must never overwrite a populated backup.
    expect(hasContent(skeleton("2026-09-15T12:00:00Z"))).toBe(false);
  });

  it("recognises work in any of the engine's stores", () => {
    expect(hasContent(withAnswers("2026-09-15T10:00:00Z"))).toBe(true);
    expect(hasContent({ iamObjResponses: { "D3-01": {} } })).toBe(true);
    expect(hasContent({ iamR: { "D3-01": 2 } })).toBe(true);
    expect(hasContent({ notes: { "RD-1-g": "see policy" } })).toBe(true);
  });

  it("is false for null", () => {
    expect(hasContent(null)).toBe(false);
  });
});

describe("savedAtMs", () => {
  it("reads a valid timestamp and rejects anything else", () => {
    expect(savedAtMs({ savedAt: "2026-09-15T10:00:00Z" })).toBe(Date.parse("2026-09-15T10:00:00Z"));
    expect(savedAtMs({ savedAt: "not a date" })).toBe(0);
    expect(savedAtMs({})).toBe(0);
    expect(savedAtMs(null)).toBe(0);
  });
});

describe("reconcile", () => {
  const older = withAnswers("2026-09-15T09:00:00Z");
  const newer = withAnswers("2026-09-15T11:00:00Z");

  it("pushes when only the browser has work", () => {
    expect(reconcile(newer, null).action).toBe("push");
  });

  it("restores when only the server has work", () => {
    expect(reconcile(null, remoteOf(newer)).action).toBe("restore");
    expect(reconcile(skeleton("2026-09-15T12:00:00Z"), remoteOf(newer)).action).toBe("restore");
  });

  it("does nothing when neither side has work", () => {
    expect(reconcile(null, null).action).toBe("none");
    expect(reconcile(skeleton("2026-09-15T12:00:00Z"), null).action).toBe("none");
  });

  it("prefers whichever side the engine saved more recently", () => {
    expect(reconcile(newer, remoteOf(older)).action).toBe("push");
    expect(reconcile(older, remoteOf(newer)).action).toBe("restore");
  });

  it("does nothing on a tie, rather than writing for the sake of it", () => {
    expect(reconcile(newer, remoteOf(newer)).action).toBe("none");
  });

  it("never lets a fresh empty browser overwrite a populated backup", () => {
    // The dangerous shape: local is newer by timestamp but holds nothing.
    const decision = reconcile(skeleton("2026-09-16T00:00:00Z"), remoteOf(older));
    expect(decision.action).toBe("restore");
  });

  it("never discards populated local work for an empty backup", () => {
    const decision = reconcile(older, remoteOf(skeleton("2026-09-16T00:00:00Z")));
    expect(decision.action).toBe("push");
  });

  it("treats a document with no timestamp as oldest, not newest", () => {
    const undated = withAnswers(undefined as unknown as string);
    expect(reconcile(undated, remoteOf(newer)).action).toBe("restore");
  });
});

describe("checkSize", () => {
  it("accepts a normal document", () => {
    const check = checkSize(withAnswers("2026-09-15T10:00:00Z"));
    expect(check.ok).toBe(true);
    expect(check.limit).toBe(MAX_STATE_BYTES);
  });

  it("rejects one past the database's ceiling", () => {
    const big = { ...withAnswers("2026-09-15T10:00:00Z"), files: { a: "x".repeat(MAX_STATE_BYTES) } };
    const check = checkSize(big);
    expect(check.ok).toBe(false);
    expect(check.bytes).toBeGreaterThan(MAX_STATE_BYTES);
  });

  it("measures bytes, not characters, so multi-byte content cannot slip past", () => {
    // "€" is one character but three UTF-8 bytes.
    const euro = checkSize({ notes: { a: "€".repeat(10) } });
    const ascii = checkSize({ notes: { a: "e".repeat(10) } });
    expect(euro.bytes).toBeGreaterThan(ascii.bytes);
  });
});

describe("applyRestore", () => {
  it("keeps the displaced document instead of discarding it", () => {
    const local = withAnswers("2026-09-15T09:00:00Z", { "RD-1-g": 1 });
    const storage = memoryStorage({ [ENGINE_STATE_KEY]: JSON.stringify(local) });
    const remote = remoteOf(withAnswers("2026-09-15T11:00:00Z", { "RD-1-g": 4 }));

    applyRestore(storage, remote);

    expect(parseState(storage.getItem(ENGINE_STATE_KEY))?.answers).toEqual({ "RD-1-g": 4 });
    expect(parseState(storage.getItem(REPLACED_BACKUP_KEY))?.answers).toEqual({ "RD-1-g": 1 });
  });

  it("still restores when the backup copy cannot be written", () => {
    const storage = memoryStorage({ [ENGINE_STATE_KEY]: "{}" });
    const remote = remoteOf(withAnswers("2026-09-15T11:00:00Z"));
    // Simulate a full quota only for the aside copy.
    const original = storage.setItem;
    let calls = 0;
    storage.setItem = (k: string, v: string) => {
      if (++calls === 1) throw new Error("QuotaExceededError");
      original.call(storage, k, v);
    };
    expect(() => applyRestore(storage, remote)).not.toThrow();
    expect(parseState(storage.getItem(ENGINE_STATE_KEY))?.savedAt).toBe("2026-09-15T11:00:00Z");
  });
});

describe("syncOnce", () => {
  const table = (remote: RemoteRecord | null) => ({
    loadLatest: vi.fn().mockResolvedValue(remote),
    save: vi.fn().mockResolvedValue(undefined),
  });

  it("saves local work when the server has none", async () => {
    const local = withAnswers("2026-09-15T10:00:00Z");
    const storage = memoryStorage({ [ENGINE_STATE_KEY]: JSON.stringify(local) });
    const t = table(null);
    const statuses: string[] = [];

    const result = await syncOnce({ storage, table: t, onStatus: s => statuses.push(s.state) });

    expect(result.action).toBe("push");
    expect(t.save).toHaveBeenCalledWith(local, "2026-09-15T10:00:00Z", 9);
    expect(statuses).toEqual(["syncing", "saved"]);
  });

  it("restores into the browser when the backup is newer", async () => {
    const storage = memoryStorage({
      [ENGINE_STATE_KEY]: JSON.stringify(withAnswers("2026-09-15T09:00:00Z")),
    });
    const t = table(remoteOf(withAnswers("2026-09-15T11:00:00Z", { "RD-1-g": 5 })));

    const result = await syncOnce({ storage, table: t });

    expect(result.action).toBe("restore");
    expect(parseState(storage.getItem(ENGINE_STATE_KEY))?.answers).toEqual({ "RD-1-g": 5 });
    expect(t.save).not.toHaveBeenCalled();
  });

  it("refuses an oversized document and says so, instead of failing at the database", async () => {
    const big = { ...withAnswers("2026-09-15T10:00:00Z"), files: { a: "x".repeat(MAX_STATE_BYTES) } };
    const storage = memoryStorage({ [ENGINE_STATE_KEY]: JSON.stringify(big) });
    const t = table(null);
    const statuses: unknown[] = [];

    const result = await syncOnce({ storage, table: t, onStatus: s => statuses.push(s) });

    expect(result.action).toBe("none");
    expect(t.save).not.toHaveBeenCalled();
    expect(statuses[0]).toMatchObject({ state: "too-large" });
  });

  it("leaves local data alone when the backup cannot be reached", async () => {
    const local = withAnswers("2026-09-15T10:00:00Z");
    const storage = memoryStorage({ [ENGINE_STATE_KEY]: JSON.stringify(local) });
    const t = {
      loadLatest: vi.fn().mockRejectedValue(new Error("network down")),
      save: vi.fn(),
    };
    const statuses: unknown[] = [];

    const result = await syncOnce({ storage, table: t, onStatus: s => statuses.push(s) });

    expect(result.action).toBe("none");
    expect(t.save).not.toHaveBeenCalled();
    expect(parseState(storage.getItem(ENGINE_STATE_KEY))).toEqual(local);
    expect(statuses[0]).toMatchObject({ state: "error" });
  });

  it("reports a failed save without touching local data", async () => {
    const local = withAnswers("2026-09-15T10:00:00Z");
    const storage = memoryStorage({ [ENGINE_STATE_KEY]: JSON.stringify(local) });
    const t = {
      loadLatest: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockRejectedValue(new Error("row level security")),
    };
    const statuses: unknown[] = [];

    const result = await syncOnce({ storage, table: t, onStatus: s => statuses.push(s) });

    expect(result.action).toBe("none");
    expect(parseState(storage.getItem(ENGINE_STATE_KEY))).toEqual(local);
    expect(statuses.at(-1)).toMatchObject({ state: "error" });
  });

  it("does nothing at all on a fresh browser with no backup", async () => {
    const storage = memoryStorage();
    const t = table(null);
    const result = await syncOnce({ storage, table: t });
    expect(result.action).toBe("none");
    expect(t.save).not.toHaveBeenCalled();
    expect(storage.getItem(ENGINE_STATE_KEY)).toBeNull();
  });
});
