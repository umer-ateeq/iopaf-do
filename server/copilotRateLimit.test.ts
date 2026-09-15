import { beforeEach, describe, expect, it } from "vitest";
import { enforceRateLimit, resetRateLimits } from "./routers/copilot";

/**
 * The limit was keyed on users.id. On this host that id is the synthetic -1
 * whenever the users row is unavailable — which is the normal state, because
 * the row is written by a Supabase Edge Function and DATABASE_URL is
 * deliberately absent. Every caller therefore shared one bucket, turning a
 * per-user limit into a platform-wide one: twelve questions from any mix of
 * users locked out everybody for a minute.
 */
describe("Copilot rate limiting", () => {
  beforeEach(() => resetRateLimits());

  it("allows a user up to twelve requests a minute", () => {
    for (let i = 0; i < 12; i++) expect(() => enforceRateLimit("user-a")).not.toThrow();
    expect(() => enforceRateLimit("user-a")).toThrow(/request limit reached/i);
  });

  it("does not let one user's traffic exhaust another's allowance", () => {
    for (let i = 0; i < 12; i++) enforceRateLimit("user-a");
    expect(() => enforceRateLimit("user-a")).toThrow();

    // The regression: this threw too, because both resolved to id -1.
    expect(() => enforceRateLimit("user-b")).not.toThrow();
    for (let i = 1; i < 12; i++) expect(() => enforceRateLimit("user-b")).not.toThrow();
    expect(() => enforceRateLimit("user-b")).toThrow();
  });

  it("keeps many users independent", () => {
    const users = Array.from({ length: 20 }, (_, i) => `user-${i}`);
    for (const user of users) {
      for (let i = 0; i < 12; i++) expect(() => enforceRateLimit(user)).not.toThrow();
    }
    for (const user of users) expect(() => enforceRateLimit(user)).toThrow();
  });
});
