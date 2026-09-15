import { boolean, integer, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Core user table backing the auth flow.
 *
 * Ported from MySQL to Postgres (Supabase). Column names remain camelCase so
 * that the generated types and every call site stay unchanged; Postgres keeps
 * them case-sensitive via quoted identifiers, which Drizzle emits automatically.
 */
export const userRole = pgEnum("user_role", ["user", "admin"]);

export const users = pgTable("users", {
  /** Surrogate primary key. Identity column managed by the database. */
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  /** Stable identifier from the auth provider. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRole("role").default("user").notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  /** Maintained by the users_set_updated_at trigger (Postgres has no ON UPDATE). */
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn", { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Per-user AI Copilot preferences.
 *
 * The platform talks to a single OpenAI-compatible account whose credential
 * lives only in the server environment (OPENAI_API_KEY), so nothing in this
 * table is secret: there is deliberately no provider, endpoint or API-key
 * column. Users choose whether the Copilot is on, which catalogue model to
 * use, and how much of their assessment response may leave the server.
 */
export const copilotSettings = pgTable("copilotSettings", {
  /** Surrogate primary key. Identity column managed by the database. */
  id: integer("id").generatedAlwaysAsIdentity().primaryKey(),
  /** One settings row per user. Removed with the user. */
  userId: integer("userId")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").default(true).notNull(),
  model: varchar("model", { length: 255 }).default("gpt-4o-mini").notNull(),
  /** Allow current ratings, evidence summaries and risk values into the prompt. */
  includeCurrentResponse: boolean("includeCurrentResponse").default(false).notNull(),
  /** Allow the active remediation text into the prompt. */
  includeRemediation: boolean("includeRemediation").default(false).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true }).defaultNow().notNull(),
  /** Maintained by the copilotSettings_set_updated_at trigger. */
  updatedAt: timestamp("updatedAt", { withTimezone: true }).defaultNow().notNull(),
});

export type CopilotSetting = typeof copilotSettings.$inferSelect;
export type InsertCopilotSetting = typeof copilotSettings.$inferInsert;
