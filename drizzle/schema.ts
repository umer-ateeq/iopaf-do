import { integer, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

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
