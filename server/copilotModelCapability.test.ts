import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The model catalogue mixes reasoning and non-reasoning families with
 * different accepted parameters and token ceilings. Rather than a hardcoded
 * capability table, llm.ts sends the modern parameters and learns each
 * model's limits from the provider's own rejection messages.
 *
 * These are the cases that broke a real conversation during testing: a
 * reasoning model spending its whole budget on hidden reasoning, a
 * non-reasoning model rejecting reasoning_effort, and an old model capping
 * completion tokens.
 */

let invokeLLM: typeof import("./_core/llm").invokeLLM;

beforeAll(async () => {
  // ENV is captured at module load, so the key must exist before the import.
  process.env.OPENAI_API_KEY = "sk-test-not-a-real-key";
  process.env.OPENAI_BASE_URL = "https://provider.test/v1";
  ({ invokeLLM } = await import("./_core/llm"));
});

afterEach(() => vi.unstubAllGlobals());

const completion = (content: string | null, finish = "stop") => ({
  ok: true,
  status: 200,
  json: async () => ({
    id: "cmpl_1",
    model: "m",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: finish }],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  }),
});

const rejection = (message: string) => ({
  ok: false,
  status: 400,
  text: async () => JSON.stringify({ error: { message } }),
});

/** Captures each request body the client sends. */
function recorder(responses: Array<unknown>) {
  const bodies: Array<Record<string, unknown>> = [];
  let call = 0;
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)));
    return responses[Math.min(call++, responses.length - 1)];
  });
  vi.stubGlobal("fetch", fetchMock);
  return bodies;
}

const ask = (model: string) =>
  invokeLLM({ model, messages: [{ role: "user", content: "hello" }] });

describe("Copilot model capability negotiation", () => {
  it("asks for low reasoning effort so hidden reasoning cannot eat the whole budget", async () => {
    const bodies = recorder([completion("answer")]);
    await ask("gpt-5-mini");

    expect(bodies).toHaveLength(1);
    expect(bodies[0].reasoning_effort).toBe("low");
    expect(bodies[0].max_completion_tokens).toBe(4000);
    // max_tokens is the legacy parameter and must not be sent.
    expect(bodies[0]).not.toHaveProperty("max_tokens");
  });

  it("sends max_tokens and no reasoning_effort to Claude and Gemini", async () => {
    // These arrive through the same OpenAI-compatible endpoint but take the
    // other spelling. Gemini can answer with an empty length-limited response
    // if given max_completion_tokens, which looks like the model failing.
    for (const model of ["claude-sonnet-4-5", "gemini-2.5-pro"]) {
      const bodies = recorder([completion("answer")]);
      await ask(model);

      expect(bodies, model).toHaveLength(1);
      expect(bodies[0].max_tokens, model).toBe(4000);
      expect(bodies[0], model).not.toHaveProperty("max_completion_tokens");
      expect(bodies[0], model).not.toHaveProperty("reasoning_effort");
    }
  });

  it("drops reasoning_effort for a model that rejects it, then remembers", async () => {
    const bodies = recorder([
      rejection("Unrecognized request argument supplied: reasoning_effort"),
      completion("answer"),
    ]);
    const result = await ask("gpt-4o");

    expect(result.choices[0].message.content).toBe("answer");
    expect(bodies).toHaveLength(2);
    expect(bodies[0].reasoning_effort).toBe("low");
    expect(bodies[1]).not.toHaveProperty("reasoning_effort");

    // A second conversation must not repeat the rejected attempt.
    const again = recorder([completion("second")]);
    await ask("gpt-4o");
    expect(again).toHaveLength(1);
    expect(again[0]).not.toHaveProperty("reasoning_effort");
  });

  it("retries inside a model's completion-token ceiling, then remembers", async () => {
    const bodies = recorder([
      rejection("max_tokens is too large: 4000. This model supports at most 2048 completion tokens, whereas you provided 4000."),
      completion("answer"),
    ]);
    await ask("gpt-4-turbo");

    expect(bodies).toHaveLength(2);
    expect(bodies[0].max_completion_tokens).toBe(4000);
    expect(bodies[1].max_completion_tokens).toBe(2048);

    const again = recorder([completion("second")]);
    await ask("gpt-4-turbo");
    expect(again).toHaveLength(1);
    expect(again[0].max_completion_tokens).toBe(2048);
  });

  it("gives up rather than looping when a rejection teaches it nothing", async () => {
    recorder([rejection("You do not have access to this model")]);
    await expect(ask("gpt-forbidden")).rejects.toThrow(/HTTP 400/);
  });

  it("does not retry a timeout, because the completion may already be billed", async () => {
    const timeout = Object.assign(new Error("The operation was aborted due to timeout"), {
      name: "TimeoutError",
    });
    const fetchMock = vi.fn(async () => {
      throw timeout;
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(ask("gpt-slow")).rejects.toThrow(/did not respond within 90 seconds/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never leaks the provider credential into an error message", async () => {
    recorder([rejection("Incorrect API key provided: sk-proj-abcdef1234567890. Check your key.")]);
    await expect(ask("gpt-bad-key")).rejects.toThrow(/\[redacted\]/);
    await expect(ask("gpt-bad-key")).rejects.not.toThrow(/sk-proj-abcdef1234567890/);
  });
});
