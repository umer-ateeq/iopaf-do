import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";

let streamLLM: typeof import("./_core/llm").streamLLM;

beforeAll(async () => {
  process.env.OPENAI_API_KEY = "sk-test-not-a-real-key";
  process.env.OPENAI_BASE_URL = "https://provider.test/v1";
  ({ streamLLM } = await import("./_core/llm"));
});

afterEach(() => vi.unstubAllGlobals());

/** Serve a byte stream in arbitrary pieces, as a network actually would. */
function stubStream(pieces: string[], ok = true, status = 200) {
  const encoder = new TextEncoder();
  const bodies: Array<Record<string, unknown>> = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      if (!ok) return { ok: false, status, text: async () => JSON.stringify({ error: { message: "nope" } }) };
      return {
        ok: true,
        status: 200,
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            for (const piece of pieces) controller.enqueue(encoder.encode(piece));
            controller.close();
          },
        }),
      };
    })
  );
  return bodies;
}

const delta = (text: string) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`;

async function collect(model = "gpt-5-mini") {
  const out: string[] = [];
  for await (const piece of streamLLM({ model, messages: [{ role: "user", content: "hi" }] })) {
    out.push(piece);
  }
  return out;
}

describe("Copilot answer streaming", () => {
  it("yields each token as it arrives", async () => {
    stubStream([delta("Evidence"), delta("-gated"), delta(" maturity"), "data: [DONE]\n\n"]);
    expect((await collect()).join("")).toBe("Evidence-gated maturity");
  });

  it("reassembles a record split across two network chunks", async () => {
    // The failure this guards: a chunk boundary landing inside the JSON, which
    // naive per-chunk parsing drops or throws on.
    const whole = delta("Incident Management");
    const cut = Math.floor(whole.length / 2);
    stubStream([whole.slice(0, cut), whole.slice(cut), "data: [DONE]\n\n"]);
    expect((await collect()).join("")).toBe("Incident Management");
  });

  it("handles several records delivered in one chunk", async () => {
    stubStream([delta("a") + delta("b") + delta("c"), "data: [DONE]\n\n"]);
    expect((await collect()).join("")).toBe("abc");
  });

  it("ignores keep-alives, comments and the terminator", async () => {
    stubStream([": ping\n\n", delta("x"), "data: [DONE]\n\n", "\n\n"]);
    expect((await collect()).join("")).toBe("x");
  });

  it("skips a malformed record rather than abandoning the answer", async () => {
    stubStream([delta("before"), "data: {not json\n\n", delta("after"), "data: [DONE]\n\n"]);
    expect((await collect()).join("")).toBe("beforeafter");
  });

  it("ignores deltas that carry no text, such as the opening role frame", async () => {
    stubStream([
      `data: ${JSON.stringify({ choices: [{ delta: { role: "assistant" } }] })}\n\n`,
      delta("real"),
      `data: ${JSON.stringify({ choices: [{ delta: { content: null } }] })}\n\n`,
      "data: [DONE]\n\n",
    ]);
    expect((await collect()).join("")).toBe("real");
  });

  it("yields nothing when the model produces no visible tokens", async () => {
    // A reasoning model can spend its whole budget thinking. The caller turns
    // an empty result into a message naming the model.
    stubStream(["data: [DONE]\n\n"]);
    expect(await collect()).toEqual([]);
  });

  it("asks the provider to stream, with the family's own token parameter", async () => {
    const bodies = stubStream([delta("x"), "data: [DONE]\n\n"]);
    await collect("gpt-5-mini");
    expect(bodies[0].stream).toBe(true);
    expect(bodies[0].max_completion_tokens).toBe(4000);
    expect(bodies[0].reasoning_effort).toBe("low");

    const claude = stubStream([delta("y"), "data: [DONE]\n\n"]);
    await collect("claude-sonnet-4-5");
    expect(claude[0].stream).toBe(true);
    expect(claude[0].max_tokens).toBe(4000);
    expect(claude[0]).not.toHaveProperty("max_completion_tokens");
    expect(claude[0]).not.toHaveProperty("reasoning_effort");
  });

  it("reports a refused request before any bytes are streamed", async () => {
    stubStream([], false, 429);
    await expect(collect()).rejects.toThrow(/HTTP 429/);
  });
});
