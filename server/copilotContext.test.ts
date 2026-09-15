import { describe, expect, it } from "vitest";
import { buildAllowedCopilotContext, buildCopilotSystemPrompt, copilotContextSchema } from "./routers/copilot";

const context = copilotContextSchema.parse({
  page: "controls",
  stream: "iam",
  mode: "remediation",
  control: {
    id: "D3-01",
    statement: "Enforce strong authentication.",
    source: "NIST / ISO",
    target: "Production database",
    maturity: 2,
    evidence: "sampled",
    tested: 20,
    exceptions: 3,
    posteriorMean: 0.18,
    credibleInterval: [0.08, 0.32],
  },
  remediation: {
    description: "Expand MFA coverage and close exceptions.",
    owner: "IAM lead",
    status: "Open",
  },
});

describe("Copilot context minimization", () => {
  it("removes current response, posterior and remediation unless explicitly enabled", () => {
    const safe = JSON.parse(buildAllowedCopilotContext(context, false, false));
    expect(safe.control.id).toBe("D3-01");
    expect(safe.control.statement).toContain("authentication");
    expect(safe.control.maturity).toBeUndefined();
    expect(safe.control.posteriorMean).toBeUndefined();
    expect(safe.remediation).toBeUndefined();
  });

  it("retains allowed response and remediation fields when both privacy settings are enabled", () => {
    const allowed = JSON.parse(buildAllowedCopilotContext(context, true, true));
    expect(allowed.control.maturity).toBe(2);
    expect(allowed.control.exceptions).toBe(3);
    expect(allowed.remediation.owner).toBe("IAM lead");
  });

  it("sets non-negotiable advisory and reference boundaries in the system prompt", () => {
    const prompt = buildCopilotSystemPrompt(buildAllowedCopilotContext(context, false, false));
    expect(prompt).toMatch(/never invent clauses or quotations/i);
    expect(prompt).toMatch(/Do not change or claim to change/i);
    expect(prompt).toContain("D3-01");
  });

  it("rejects oversized free text at the context boundary", () => {
    expect(() => copilotContextSchema.parse({
      page: "controls",
      stream: "iam",
      mode: "control",
      control: { statement: "x".repeat(1001) },
    })).toThrow();
  });
});
