import { describe, expect, it } from "vitest";
import { chatInputSchema, trimConversation } from "./routers/copilot";

/**
 * A follow-up question carries the model's own previous answer back as
 * history. Those answers are routinely longer than any limit meant for typed
 * user input, so the two roles cannot share one length cap: capping the
 * assistant at the user's limit makes the Copilot single-turn, rejecting every
 * follow-up before it reaches the model.
 */
const userTurn = (content: string) => ({ role: "user" as const, content });
const assistantTurn = (content: string) => ({ role: "assistant" as const, content });

const context = { page: "assess" as const, stream: "sdlc" as const, mode: "question" as const };

describe("Copilot conversation limits", () => {
  it("accepts a follow-up after a long assistant answer", () => {
    // 7,704 characters is the length actually measured in the browser.
    const conversation = {
      messages: [userTurn("hi"), assistantTurn("x".repeat(7704)), userTurn("hi")],
      context,
    };
    expect(() => chatInputSchema.parse(conversation)).not.toThrow();
  });

  it("still holds typed user input to a sane length", () => {
    expect(() => chatInputSchema.parse({ messages: [userTurn("x".repeat(4001))], context })).toThrow();
    expect(() => chatInputSchema.parse({ messages: [userTurn("x".repeat(4000))], context })).not.toThrow();
  });

  it("rejects an assistant turn beyond anything the server could have produced", () => {
    expect(() =>
      chatInputSchema.parse({ messages: [userTurn("hi"), assistantTurn("x".repeat(40_001))], context })
    ).toThrow();
  });

  it("requires the conversation to end with a user turn", () => {
    expect(() =>
      chatInputSchema.parse({ messages: [userTurn("hi"), assistantTurn("answer")], context })
    ).toThrow(/user/i);
  });
});

describe("Copilot conversation trimming", () => {
  it("leaves a short conversation untouched", () => {
    const messages = [userTurn("one"), assistantTurn("two"), userTurn("three")];
    expect(trimConversation(messages)).toEqual(messages);
  });

  it("drops the oldest turns when the history grows too large", () => {
    // Three full-length answers exceed the 60,000-character budget; two do not.
    const messages = [
      userTurn("oldest question"),
      assistantTurn("x".repeat(25_000)),
      userTurn("middle question"),
      assistantTurn("y".repeat(25_000)),
      userTurn("later question"),
      assistantTurn("z".repeat(25_000)),
      userTurn("newest question"),
    ];
    const trimmed = trimConversation(messages);

    // The newest turn always survives, and the total shrinks.
    expect(trimmed[trimmed.length - 1].content).toBe("newest question");
    expect(trimmed.length).toBeLessThan(messages.length);
    const total = trimmed.reduce((n, m) => n + m.content.length, 0);
    expect(total).toBeLessThanOrEqual(60_000);
  });

  it("never drops the newest user turn, however long the history", () => {
    const messages = [
      ...Array.from({ length: 5 }, () => assistantTurn("q".repeat(20_000))),
      userTurn("the actual question"),
    ];
    const trimmed = trimConversation(messages);
    expect(trimmed.some(m => m.content === "the actual question")).toBe(true);
  });
});
