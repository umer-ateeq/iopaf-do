import { describe, expect, it } from "vitest";
import { modelFamily, selectChatModels } from "./routers/copilot";
import { isGptFamily } from "./_core/llm";

/**
 * An OpenAI-compatible gateway can serve GPT, Claude and Gemini from one
 * endpoint. The original filter matched only GPT, so every Claude and Gemini
 * model the account offered was silently dropped — indistinguishable, from the
 * Setup screen, from a gateway that had nothing to offer.
 */
describe("model catalogue selection", () => {
  it("keeps all three chat families", () => {
    const models = selectChatModels([
      "gpt-5-mini",
      "claude-sonnet-4-5",
      "gemini-2.5-pro",
      "o3-mini",
    ]);
    expect(models.map(m => m.id).sort()).toEqual([
      "claude-sonnet-4-5",
      "gemini-2.5-pro",
      "gpt-5-mini",
      "o3-mini",
    ]);
  });

  it("labels each family rather than splitting on the first dash", () => {
    expect(modelFamily("gpt-5-mini")).toBe("GPT");
    expect(modelFamily("o3-mini")).toBe("GPT");
    expect(modelFamily("chatgpt-4o-latest")).toBe("GPT");
    expect(modelFamily("claude-sonnet-4-5")).toBe("Claude");
    expect(modelFamily("gemini-2.5-pro")).toBe("Gemini");
    expect(modelFamily("mistral-large")).toBe("Other");
  });

  it("groups by family, then by id", () => {
    const models = selectChatModels(["gpt-5", "gemini-2.5-pro", "claude-opus-4", "gpt-4o"]);
    expect(models.map(m => `${m.family}:${m.id}`)).toEqual([
      "Claude:claude-opus-4",
      "Gemini:gemini-2.5-pro",
      "GPT:gpt-4o",
      "GPT:gpt-5",
    ]);
  });

  it("sees through a gateway namespace prefix", () => {
    // A prefix must not let a non-chat model through, nor hide a chat one.
    const models = selectChatModels([
      "anthropic/claude-sonnet-4-5",
      "openai/gpt-5-mini",
      "openai/text-embedding-3-large",
    ]);
    expect(models.map(m => m.id)).toEqual([
      "anthropic/claude-sonnet-4-5",
      "openai/gpt-5-mini",
    ]);
    expect(modelFamily("anthropic/claude-sonnet-4-5")).toBe("Claude");
  });

  it("still excludes what cannot answer a chat request", () => {
    const models = selectChatModels([
      "gpt-5-mini",
      "text-embedding-3-large",
      "whisper-1",
      "dall-e-3",
      "tts-1",
      "gpt-3.5-turbo-instruct",
      "gpt-5.1-codex",
      "gpt-4o-realtime-preview",
      "omni-moderation-latest",
    ]);
    expect(models.map(m => m.id)).toEqual(["gpt-5-mini"]);
  });

  it("passes every model from a real multi-provider gateway response", () => {
    // Captured from a live cross-provider gateway: four Claude, two Gemini,
    // four GPT. Under the GPT-only filter this list rendered as four models.
    const live = [
      "claude-haiku-4-5",
      "claude-opus-4-6",
      "claude-opus-4-7",
      "claude-sonnet-4-6",
      "gemini-3.1-pro-preview",
      "gemini-3-flash-preview",
      "gpt-5",
      "gpt-5.5",
      "gpt-5-mini",
      "gpt-5-nano",
    ];
    const models = selectChatModels(live);
    expect(models).toHaveLength(10);
    expect(models.filter(m => m.family === "Claude")).toHaveLength(4);
    expect(models.filter(m => m.family === "Gemini")).toHaveLength(2);
    expect(models.filter(m => m.family === "GPT")).toHaveLength(4);
  });

  it("still collapses dated snapshots onto their stable alias", () => {
    const models = selectChatModels([
      "gpt-5-mini",
      "gpt-5-mini-2025-08-07",
      "claude-sonnet-4-5",
      "claude-sonnet-4-5-20250929",
    ]);
    expect(models.map(m => m.id)).toEqual(["claude-sonnet-4-5", "gpt-5-mini"]);
  });
});

/**
 * The token-budget parameter is not portable. OpenAI's newer models take
 * max_completion_tokens; Claude and Gemini on a compatible gateway take
 * max_tokens, and Gemini can return an empty length-limited answer if given
 * the OpenAI spelling.
 */
describe("token parameter family detection", () => {
  it("treats GPT and o-series as the OpenAI family", () => {
    for (const model of ["gpt-5-mini", "gpt-4o", "o1", "o3-mini", "o4-mini", "chatgpt-4o-latest"]) {
      expect(isGptFamily(model), model).toBe(true);
    }
  });

  it("treats Claude and Gemini as not that family", () => {
    for (const model of ["claude-sonnet-4-5", "claude-opus-4", "gemini-2.5-pro", "gemini-2.0-flash"]) {
      expect(isGptFamily(model), model).toBe(false);
    }
  });

  it("is case-insensitive", () => {
    expect(isGptFamily("GPT-5-Mini")).toBe(true);
    expect(isGptFamily("Claude-Sonnet-4-5")).toBe(false);
  });
});
