import { describe, expect, it } from "vitest";
import { redactSecrets } from "./_core/llm";

/**
 * The platform holds a single provider credential for every user, so the two
 * things that must never happen are: a key reaching a client through an error
 * message, and a client being able to substitute its own provider.
 */
describe("Copilot credential boundary", () => {
  it("redacts provider keys out of upstream error text", () => {
    const leaked = "401 Unauthorized: key sk-proj-AbCdEf0123456789XyZ is invalid";
    const safe = redactSecrets(leaked);
    expect(safe).not.toContain("sk-proj-AbCdEf0123456789XyZ");
    expect(safe).toContain("[redacted]");
  });

  it("redacts every occurrence, not just the first", () => {
    const safe = redactSecrets("sk-aaaaaaaaaaaa then sk-bbbbbbbbbbbb");
    expect(safe).toBe("[redacted] then [redacted]");
  });

  it("leaves text without a credential untouched", () => {
    const message = "The model returned an empty response";
    expect(redactSecrets(message)).toBe(message);
  });
});
