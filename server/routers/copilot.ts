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
import {
  getCopilotSettingsByOpenId,
  isSettingsStoreAvailable,
  upsertCopilotSettings,
} from "../db";

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

/**
 * A turn's length limit depends on who wrote it. 4,000 characters is a sane
 * bound on typed user input, but an assistant turn is this server's own
 * previous answer replayed as history, and those run far longer — measured at
 * 7,704 characters in the portal. Sharing the user's cap made every follow-up
 * fail validation before it reached the model, so the Copilot was single-turn.
 * The assistant bound is generous but finite: the completion budget is 4,000
 * tokens, so no genuine answer approaches 40,000 characters.
 */
const USER_CONTENT_MAX = 4000;
const ASSISTANT_CONTENT_MAX = 40_000;
/** Total characters of history sent upstream, oldest turns dropped first. */
const CONVERSATION_CHARS_MAX = 60_000;

const messageSchema = z.discriminatedUnion("role", [
  z.object({
    role: z.literal("user"),
    content: z.string().trim().min(1).max(USER_CONTENT_MAX),
  }),
  z.object({
    role: z.literal("assistant"),
    content: z.string().trim().min(1).max(ASSISTANT_CONTENT_MAX),
  }),
]);

export type CopilotTurn = z.infer<typeof messageSchema>;

export const chatInputSchema = z
  .object({
    messages: z.array(messageSchema).min(1).max(12),
    context: copilotContextSchema,
  })
  .refine(value => value.messages[value.messages.length - 1]?.role === "user", {
    message: "The conversation must end with a user message",
    path: ["messages"],
  });

/**
 * Keep the newest turns within a total character budget. Long answers
 * accumulate quickly, and an unbounded history means an ever-growing prompt
 * billed on every follow-up. The final user turn is always kept, even when it
 * alone exceeds the budget.
 */
export function trimConversation(messages: CopilotTurn[]): CopilotTurn[] {
  const kept: CopilotTurn[] = [];
  let total = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (kept.length && total + message.content.length > CONVERSATION_CHARS_MAX) break;
    kept.unshift(message);
    total += message.content.length;
  }

  return kept;
}

const RATE_LIMIT_PER_MINUTE = 12;

/**
 * Keyed on openId, not users.id. Without a reachable users row every caller
 * authenticates as the synthetic id -1, which turned this per-user limit into
 * a single platform-wide bucket: twelve questions from any mix of users locked
 * out everyone. openId comes from the verified session JWT and is unique.
 */
const rateBuckets = new Map<string, number[]>();

export function enforceRateLimit(openId: string) {
  const now = Date.now();
  const recent = (rateBuckets.get(openId) || []).filter(t => now - t < 60_000);
  if (recent.length >= RATE_LIMIT_PER_MINUTE) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Copilot request limit reached. Please wait a minute and try again.",
    });
  }
  recent.push(now);
  rateBuckets.set(openId, recent);
}

/** Test seam: the buckets are process-global. */
export function resetRateLimits() {
  rateBuckets.clear();
}

function defaultSettings() {
  return {
    enabled: true,
    model: ENV.copilotDefaultModel,
    includeCurrentResponse: false,
    includeRemediation: false,
  };
}

/**
 * Exported so the streaming route resolves settings exactly as the mutation
 * does — same defaults, same privacy flags. Two code paths deciding what may
 * leave the server is how they drift apart.
 */
export async function settingsForOpenId(openId: string) {
  return (await getCopilotSettingsByOpenId(openId)) || defaultSettings();
}

const settingsFor = settingsForOpenId;

function publicSettings(
  settings: Awaited<ReturnType<typeof settingsFor>>,
  storable: boolean
) {
  return {
    enabled: settings.enabled,
    model: settings.model,
    includeCurrentResponse: settings.includeCurrentResponse,
    includeRemediation: settings.includeRemediation,
    /** Lets the UI explain itself when the server has no credential. */
    serverConfigured: isLLMConfigured(),
    /** False when no settings store is configured, so Save cannot work. */
    settingsStorable: storable,
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
  return `You are the IOPAF AI Copilot for professional IT operations, SDLC, testing and IAM control assessments. Explain the active assessment precisely and practically. Use the supplied IOPAF context as the source of truth. Distinguish an IOPAF interpretation from a verbatim source-standard requirement; never invent clauses or quotations. When evidence is missing, say so. For remediation, propose measurable actions, accountable owner roles, sequencing, completion evidence and realistic due-date logic. Do not make legal/compliance claims. Do not change or claim to change assessment answers, maturity scores, evidence, risk parameters or actions. Keep answers structured, concise and suitable for an assessor. Match the length of your answer to what was actually asked: reply to a greeting, an acknowledgement or a one-line clarification in a sentence or two, and reserve full structured guidance for a genuine assessment question.\n\nACTIVE IOPAF CONTEXT\n${context}`;
}

/**
 * Chat-capable models only: the catalogue also lists embeddings, audio and
 * image endpoints.
 *
 * Claude and Gemini are included because an OpenAI-compatible gateway can
 * serve all three families from one endpoint. A GPT-only pattern silently hid
 * every non-OpenAI model the account offered, which looked like the gateway
 * having nothing to give.
 */
const CHAT_MODEL_PATTERN = /^(gpt-|o[134](-|$)|chatgpt-|claude-|gemini-)/;
// -instruct is completions-only and 404s on /chat/completions; -codex is
// code-specialised; live/realtime/audio are different endpoints entirely.
const NON_CHAT_PATTERN = /(embedding|whisper|tts|dall-e|moderation|audio|realtime|transcribe|image|search|sora|instruct|codex|gpt-live)/;
/**
 * Dated snapshots and legacy suffixes duplicate their stable alias.
 *
 * Three shapes, because the providers do not agree: OpenAI uses
 * "-2025-08-07" and older "-0613", while Anthropic uses an undelimited
 * "-20250929". Only the first was handled, so every Claude snapshot appeared
 * in the list next to the alias it duplicates.
 */
const SNAPSHOT_PATTERN = /(-\d{4}-\d{2}-\d{2}|-\d{8}|-\d{4}|-16k)$/;

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

export type CatalogueModel = { id: string; family: string };

/**
 * A gateway may namespace ids, e.g. "anthropic/claude-sonnet-4". Family and
 * chat-capability are decided on the last segment so a prefix cannot hide a
 * model from the filters.
 */
function modelLeaf(id: string) {
  const slash = id.lastIndexOf("/");
  return slash === -1 ? id : id.slice(slash + 1);
}

export function modelFamily(id: string) {
  const leaf = modelLeaf(id).toLowerCase();
  if (leaf.startsWith("claude-")) return "Claude";
  if (leaf.startsWith("gemini-")) return "Gemini";
  if (/^(gpt-|o[134](-|$)|chatgpt-)/.test(leaf)) return "GPT";
  return "Other";
}

export function selectChatModels(ids: string[]): CatalogueModel[] {
  return ids
    .filter(id => {
      const leaf = modelLeaf(id);
      return (
        CHAT_MODEL_PATTERN.test(leaf) &&
        !NON_CHAT_PATTERN.test(leaf) &&
        !SNAPSHOT_PATTERN.test(leaf)
      );
    })
    .map(id => ({ id, family: modelFamily(id) }))
    .sort((a, b) => a.family.localeCompare(b.family) || a.id.localeCompare(b.id));
}

/**
 * The catalogue changes when a provider ships a model, not between page loads.
 * Caching it stops every Setup open costing a provider round trip, and the
 * in-flight promise means concurrent callers share one request rather than
 * starting a stampede after the cache expires.
 */
const CATALOGUE_TTL_MS = 15 * 60_000;
let catalogueCache: { models: CatalogueModel[]; at: number } | null = null;
let catalogueInFlight: Promise<CatalogueModel[]> | null = null;

export function clearCatalogueCache() {
  catalogueCache = null;
  catalogueInFlight = null;
}

async function loadCatalogue(): Promise<CatalogueModel[]> {
  if (catalogueCache && Date.now() - catalogueCache.at < CATALOGUE_TTL_MS) {
    return catalogueCache.models;
  }
  if (catalogueInFlight) return catalogueInFlight;

  catalogueInFlight = (async () => {
    try {
      const response = await listLLMModels();
      const models = selectChatModels(response.data.map(entry => entry.id));
      catalogueCache = { models, at: Date.now() };
      return models;
    } finally {
      catalogueInFlight = null;
    }
  })();

  return catalogueInFlight;
}

export const copilotRouter = router({
  settings: protectedProcedure.query(async ({ ctx }) =>
    publicSettings(await settingsFor(ctx.user.openId), await isSettingsStoreAvailable())
  ),

  models: protectedProcedure.query(async () => {
    assertConfigured();
    try {
      return await loadCatalogue();
    } catch (error) {
      providerError(error);
    }
  }),

  saveSettings: protectedProcedure.input(settingsInput).mutation(async ({ ctx, input }) => {
    try {
      const saved = await upsertCopilotSettings(ctx.user.openId, {
        enabled: input.enabled,
        model: input.model,
        includeCurrentResponse: input.includeCurrentResponse,
        includeRemediation: input.includeRemediation,
      });
      return publicSettings(saved || defaultSettings(), true);
    } catch (error) {
      // No settings store configured. Say so plainly: the Copilot still
      // answers on the server defaults, only the preference cannot persist.
      if (error instanceof Error && error.message === "COPILOT_SETTINGS_STORE_UNAVAILABLE") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Copilot preferences cannot be saved: this server has no settings database configured. The Copilot still answers using the platform defaults.",
        });
      }
      throw error;
    }
  }),

  testConnection: protectedProcedure.input(settingsInput).mutation(async ({ input }) => {
    assertConfigured();
    try {
      // Deliberately bypasses the cache: "Test connection" should prove the
      // provider is reachable now, not that it was fifteen minutes ago.
      clearCatalogueCache();
      const catalogue = await loadCatalogue();
      if (!catalogue.some(model => model.id === input.model)) {
        throw new Error(`${input.model} is not available to this server's provider account`);
      }
      return {
        ok: true,
        detail: `${input.model} (${modelFamily(input.model)}) is available and the provider responded`,
      };
    } catch (error) {
      providerError(error);
    }
  }),

  chat: protectedProcedure.input(chatInputSchema).mutation(async ({ ctx, input }) => {
      assertConfigured();
      enforceRateLimit(ctx.user.openId);

      const settings = await settingsFor(ctx.user.openId);
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
        ...trimConversation(input.messages).map(message => ({
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
