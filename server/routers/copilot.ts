import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  invokeLLM,
  isLLMConfigured,
  listLLMModels,
  redactSecrets,
  type Message as LlmMessage,
} from "../_core/llm";
import { ENV } from "../_core/env";
import { getCopilotSettingsByUserId, upsertCopilotSettings } from "../db";

const pageSchema = z.enum(["setup", "journey", "standards", "assess", "controls", "results", "reports", "framework", "home", "unknown"]);
const streamSchema = z.enum(["sdlc", "tmmi", "operations", "iam", "none"]);
const modeSchema = z.enum(["question", "practice", "control", "risk", "result", "remediation", "general"]);
const shortText = z.string().trim().max(1000).optional();
const tinyText = z.string().trim().max(255).optional();

/**
 * The allowlisted context contract the protected engine posts to its parent.
 * Only these keys ever reach the model; anything else the iframe sends is
 * stripped by zod before it can leave the server.
 */
export const copilotContextSchema = z.object({
  page: pageSchema.default("unknown"),
  stream: streamSchema.default("none"),
  mode: modeSchema.default("general"),
  practice: z.object({
    id: tinyText,
    name: tinyText,
    domain: tinyText,
    lifecycle: z.array(z.string().trim().max(80)).max(12).optional(),
    sourceLabels: z.array(z.string().trim().max(160)).max(12).optional(),
  }).optional(),
  question: z.object({
    id: tinyText,
    dimension: tinyText,
    text: shortText,
    reference: shortText,
    rating: z.union([z.number().min(0).max(5), z.literal("na")]).optional(),
    effectiveScore: z.number().min(0).max(5).optional(),
    hasEvidence: z.boolean().optional(),
  }).optional(),
  control: z.object({
    id: tinyText,
    domain: tinyText,
    group: tinyText,
    statement: shortText,
    source: tinyText,
    target: tinyText,
    requirement: shortText,
    goodPractice: shortText,
    evidenceRequest: shortText,
    testProcedure: shortText,
    implementation: tinyText,
    maturity: z.number().min(0).max(5).nullable().optional(),
    evidence: tinyText,
    tested: z.number().int().min(0).max(1_000_000).optional(),
    exceptions: z.number().int().min(0).max(1_000_000).optional(),
    posteriorMean: z.number().min(0).max(1).optional(),
    credibleInterval: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]).optional(),
  }).optional(),
  risk: z.object({
    scenario: tinyText,
    role: tinyText,
    likelihood: tinyText,
    consequence: tinyText,
    highOrAboveProbability: z.number().min(0).max(1).optional(),
    calibrationState: tinyText,
  }).optional(),
  remediation: z.object({
    description: shortText,
    owner: tinyText,
    due: tinyText,
    priority: tinyText,
    status: tinyText,
    completionEvidence: shortText,
  }).optional(),
});

/**
 * Saveable preferences. The platform supplies the provider credential, so
 * there is intentionally no endpoint or API-key input here; unknown keys sent
 * by an older engine build are stripped rather than rejected.
 */
const settingsInput = z.object({
  enabled: z.boolean(),
  model: z.string().trim().min(1).max(255),
  includeCurrentResponse: z.boolean(),
  includeRemediation: z.boolean(),
});

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(4000),
});

const RATE_LIMIT_PER_MINUTE = 12;
const rateBuckets = new Map<number, number[]>();

function enforceRateLimit(userId: number) {
  const now = Date.now();
  const recent = (rateBuckets.get(userId) || []).filter(t => now - t < 60_000);
  if (recent.length >= RATE_LIMIT_PER_MINUTE) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Copilot request limit reached. Please wait a minute and try again.",
    });
  }
  recent.push(now);
  rateBuckets.set(userId, recent);
}

function defaultSettings() {
  return {
    enabled: true,
    model: ENV.copilotDefaultModel,
    includeCurrentResponse: false,
    includeRemediation: false,
  };
}

async function settingsFor(userId: number) {
  return (await getCopilotSettingsByUserId(userId)) || defaultSettings();
}

function publicSettings(settings: Awaited<ReturnType<typeof settingsFor>>) {
  return {
    enabled: settings.enabled,
    model: settings.model,
    includeCurrentResponse: settings.includeCurrentResponse,
    includeRemediation: settings.includeRemediation,
    /** Lets the UI explain itself when the server has no credential. */
    serverConfigured: isLLMConfigured(),
  };
}

/**
 * Drop everything the user's privacy settings do not permit, then serialize.
 * Evidence files, organization names and raw assessment state are never part
 * of the context schema, so they cannot leak through here.
 */
export function buildAllowedCopilotContext(
  context: z.infer<typeof copilotContextSchema>,
  includeResponse: boolean,
  includeRemediation: boolean
) {
  const safe = structuredClone(context);
  if (!includeResponse) {
    if (safe.question) {
      delete safe.question.rating;
      delete safe.question.effectiveScore;
      delete safe.question.hasEvidence;
    }
    if (safe.control) {
      delete safe.control.implementation;
      delete safe.control.maturity;
      delete safe.control.evidence;
      delete safe.control.tested;
      delete safe.control.exceptions;
      delete safe.control.posteriorMean;
      delete safe.control.credibleInterval;
    }
    delete safe.risk;
  }
  if (!includeRemediation) delete safe.remediation;
  return JSON.stringify(safe, null, 2);
}

export function buildCopilotSystemPrompt(context: string) {
  return `You are the IOPAF AI Copilot for professional IT operations, SDLC, testing and IAM control assessments. Explain the active assessment precisely and practically. Use the supplied IOPAF context as the source of truth. Distinguish an IOPAF interpretation from a verbatim source-standard requirement; never invent clauses or quotations. When evidence is missing, say so. For remediation, propose measurable actions, accountable owner roles, sequencing, completion evidence and realistic due-date logic. Do not make legal/compliance claims. Do not change or claim to change assessment answers, maturity scores, evidence, risk parameters or actions. Keep answers structured, concise and suitable for an assessor.\n\nACTIVE IOPAF CONTEXT\n${context}`;
}

/** Chat-capable models only: the catalogue also lists embeddings, audio and image endpoints. */
const CHAT_MODEL_PATTERN = /^(gpt-|o[134](-|$)|chatgpt-)/;
// -instruct is completions-only and 404s on /chat/completions; -codex is
// code-specialised; live/realtime/audio are different endpoints entirely.
const NON_CHAT_PATTERN = /(embedding|whisper|tts|dall-e|moderation|audio|realtime|transcribe|image|search|sora|instruct|codex|gpt-live)/;
/** Dated snapshots and legacy suffixes duplicate their stable alias. */
const SNAPSHOT_PATTERN = /(-\d{4}-\d{2}-\d{2}|-\d{4}|-16k)$/;

function normalizeAssistantContent(value: unknown) {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map(part =>
        typeof part === "object" && part && "text" in part
          ? String((part as { text: unknown }).text)
          : ""
      )
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

/** Normalize provider failures into a safe message that can never carry a credential. */
function providerError(error: unknown): never {
  const message =
    error instanceof Error ? error.message : "The LLM provider could not complete the request";
  throw new TRPCError({
    code: "BAD_GATEWAY",
    message: redactSecrets(message).slice(0, 280),
  });
}

function assertConfigured() {
  if (!isLLMConfigured()) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "The AI Copilot is not configured on this server. Contact your administrator.",
    });
  }
}

export const copilotRouter = router({
  settings: protectedProcedure.query(async ({ ctx }) =>
    publicSettings(await settingsFor(ctx.user.id))
  ),

  models: protectedProcedure.query(async () => {
    assertConfigured();
    try {
      const models = await listLLMModels();
      return models.data
        .filter(
          model =>
            CHAT_MODEL_PATTERN.test(model.id) &&
            !NON_CHAT_PATTERN.test(model.id) &&
            !SNAPSHOT_PATTERN.test(model.id)
        )
        .map(model => ({ id: model.id, family: model.id.split("-")[0] }))
        .sort((a, b) => a.id.localeCompare(b.id));
    } catch (error) {
      providerError(error);
    }
  }),

  saveSettings: protectedProcedure.input(settingsInput).mutation(async ({ ctx, input }) => {
    const saved = await upsertCopilotSettings(ctx.user.id, {
      enabled: input.enabled,
      model: input.model,
      includeCurrentResponse: input.includeCurrentResponse,
      includeRemediation: input.includeRemediation,
    });
    return publicSettings(saved || defaultSettings());
  }),

  testConnection: protectedProcedure.input(settingsInput).mutation(async ({ input }) => {
    assertConfigured();
    try {
      const catalog = await listLLMModels();
      if (!catalog.data.some(model => model.id === input.model)) {
        throw new Error(`${input.model} is not available to this server's provider account`);
      }
      return { ok: true, detail: `${input.model} is available and the provider responded` };
    } catch (error) {
      providerError(error);
    }
  }),

  chat: protectedProcedure
    .input(
      z.object({
        messages: z.array(messageSchema).min(1).max(12),
        context: copilotContextSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      assertConfigured();
      enforceRateLimit(ctx.user.id);

      const settings = await settingsFor(ctx.user.id);
      if (!settings.enabled) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "IOPAF Copilot is disabled in Setup",
        });
      }

      const context = buildAllowedCopilotContext(
        input.context,
        settings.includeCurrentResponse,
        settings.includeRemediation
      );

      const messages: LlmMessage[] = [
        { role: "system", content: buildCopilotSystemPrompt(context) },
        ...input.messages.map(message => ({
          role: message.role,
          content: message.content,
        })),
      ];

      try {
        const response = await invokeLLM({ model: settings.model, messages });
        const choice = response.choices[0];
        const content = normalizeAssistantContent(choice?.message?.content);

        if (!content) {
          // A reasoning model that spends its whole budget on hidden reasoning
          // returns finish_reason "length" with no visible answer. Say so,
          // rather than reporting an indistinguishable "empty response".
          if (choice?.finish_reason === "length") {
            const reasoning = response.usage?.completion_tokens_details?.reasoning_tokens;
            console.warn(
              `[Copilot] ${settings.model} exhausted its token budget before answering` +
                (reasoning ? ` (${reasoning} reasoning tokens)` : "")
            );
            throw new Error(
              `${settings.model} used its whole token budget before producing an answer. Ask a narrower question, or choose a different model in Setup.`
            );
          }
          throw new Error("The model returned an empty response");
        }

        return { content, model: settings.model };
      } catch (error) {
        providerError(error);
      }
    }),
});
