import { afterAll, describe, expect, it, vi } from "vitest";
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

describe("Copilot credential presence", () => {
  const load = async (key: string | undefined) => {
    vi.resetModules();
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
    return (await import("./_core/llm")).isLLMConfigured();
  };

  it("reports unconfigured when no key is set", async () => {
    expect(await load(undefined)).toBe(false);
  });

  it("reports unconfigured for an empty or whitespace key", async () => {
    expect(await load("")).toBe(false);
    expect(await load("   ")).toBe(false);
  });

  it("treats a REPLACE_ME placeholder as unconfigured", async () => {
    // The App Platform specs ship this value; taken literally it would show a
    // configured Copilot that 401s on every question.
    expect(await load("REPLACE_ME_OPENAI_API_KEY")).toBe(false);
  });

  it("reports configured for a real-looking key", async () => {
    expect(await load("sk-proj-aaaaaaaaaaaaaaaaaaaa")).toBe(true);
  });
});

afterAll(() => {
  delete process.env.OPENAI_API_KEY;
});
