import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import {
  copilotSettings,
  InsertCopilotSetting,
  InsertUser,
  users,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    // Postgres equivalent of MySQL's ON DUPLICATE KEY UPDATE.
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getCopilotSettingsByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get Copilot settings: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(copilotSettings)
    .where(eq(copilotSettings.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function upsertCopilotSettings(
  openId: string,
  settings: Omit<InsertCopilotSetting, "id" | "openId" | "createdAt" | "updatedAt">
) {
  const db = await getDb();
  if (!db) {
    throw new Error("COPILOT_SETTINGS_STORE_UNAVAILABLE");
  }

  const values: InsertCopilotSetting = { openId, ...settings };

  // Postgres equivalent of MySQL's ON DUPLICATE KEY UPDATE.
  await db.insert(copilotSettings).values(values).onConflictDoUpdate({
    target: copilotSettings.openId,
    set: settings,
  });

  return getCopilotSettingsByOpenId(openId);
}

/**
 * Whether a settings store is configured at all.
 *
 * This host runs without DATABASE_URL by design — commit 02ce637 moved the
 * users write into a Supabase Edge Function so the Postgres password need not
 * sit on the application host. Copilot preferences do need somewhere to live,
 * so the UI asks first and explains itself rather than offering a Save button
 * that cannot work.
 */
export async function isSettingsStoreAvailable() {
  return Boolean(await getDb());
}

// TODO: add feature queries here as your schema grows.
