import { describe, expect, it } from "vitest";
import { resolveOAuthReturnPath } from "./_core/oauth";

describe("resolveOAuthReturnPath", () => {
  it("returns directly to the protected portal after account verification", () => {
    expect(resolveOAuthReturnPath("/portal")).toBe("/portal");
  });

  it("rejects external, nested and unknown return locations", () => {
    expect(resolveOAuthReturnPath("https://attacker.example")).toBe("/");
    expect(resolveOAuthReturnPath("//attacker.example")).toBe("/");
    expect(resolveOAuthReturnPath("/portal/settings")).toBe("/");
    expect(resolveOAuthReturnPath(undefined)).toBe("/");
  });
});
