/**
 * Minimal OpenAI-compatible chat client for the IOPAF AI Copilot.
 *
 * The platform holds one provider credential in ENV.openaiApiKey and uses it
 * for every signed-in user, so this module deliberately exposes no way to pass
 * a per-request key or endpoint. Callers get chat completions and the account's
 * model catalogue; nothing else is needed by the Copilot.
 *
 * The catalogue spans reasoning models (the gpt-5 and o-series families) and
 * older non-reasoning ones, which do not accept the same parameters or the
 * same token budgets. Rather than carry a hardcoded capability table that goes
 * stale every time the provider ships a model, this client sends the modern
 * parameters and learns each model's limits from the provider's own rejection
 * messages, caching what it learns for the process lifetime.
 */
import { ENV } from "./env";

export type Role = "system" | "user" | "assistant";

export type Message = {
  role: Role;
  content: string;
};

export type InvokeParams = {
  messages: Message[];
  model: string;
  maxTokens?: number;
};

export type InvokeResult = {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: { role: Role; content: string | null };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
};

export type ModelInfo = {
  id: string;
  object: string;
  created: number;
  owned_by: string;
};

export type ModelsResponse = {
  object: string;
  data: ModelInfo[];
};

/**
 * On a reasoning model this budget covers hidden reasoning AND the visible
 * answer. The upstream Manus code sent 1600, which a reasoning model can spend
 * entirely on reasoning — returning finish_reason "length" with empty content.
 */
const DEFAULT_MAX_COMPLETION_TOKENS = 4000;

/**
 * Reasoning models are slow: a long assessment answer measured over 45s in
 * testing. The budget above also keeps answers inside 4096, which is the
 * ceiling on the oldest models in the catalogue.
 */
const REQUEST_TIMEOUT_MS = 90_000;
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

/** Status codes worth a second attempt: rate limits and transient upstream faults. */
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

/** Models that rejected reasoning_effort, so it is not sent to them again. */
const noReasoningEffort = new Set<string>();
/** Completion-token ceilings the provider told us about, per model. */
const maxTokenCap = new Map<string, number>();

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Is this an OpenAI GPT or o-series model?
 *
 * Only that family takes max_completion_tokens and reasoning_effort. Claude and
 * Gemini reached through an OpenAI-compatible gateway take max_tokens instead,
 * and Gemini in particular can answer with an empty length-limited response if
 * given the OpenAI spelling.
 */
export function isGptFamily(model: string) {
  return /^(gpt-|o\d|chatgpt-)/.test(model.toLowerCase());
}

function assertConfigured() {
  if (!ENV.openaiApiKey) {
    throw new Error(
      "The AI Copilot is not configured on this server: OPENAI_API_KEY is missing"
    );
  }
}

function apiUrl(path: string) {
  return `${ENV.openaiBaseUrl.replace(/\/+$/, "")}${path}`;
}

/**
 * Strip any provider credential out of text before it can reach a client,
 * a log line or an error message.
 */
export function redactSecrets(text: string) {
  return text.replace(/sk-[A-Za-z0-9_-]{8,}/g, "[redacted]");
}

/** HTTP request with backoff over transient faults. Does not interpret 4xx. */
async function request(path: string, init: RequestInit) {
  assertConfigured();

  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await sleep(BASE_BACKOFF_MS * 2 ** (attempt - 1));

    try {
      const response = await fetch(apiUrl(path), {
        ...init,
        headers: {
          ...init.headers,
          authorization: `Bearer ${ENV.openaiApiKey}`,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (response.ok || !RETRYABLE_STATUS.has(response.status)) return response;

      lastError = new Error(`LLM provider returned HTTP ${response.status}`);
      console.warn(
        `[Copilot] LLM ${path} attempt ${attempt + 1}/${MAX_ATTEMPTS} failed with HTTP ${response.status}`
      );
    } catch (error) {
      lastError = error;

      // A timed-out completion may already have been generated and billed
      // upstream, so retrying it charges the account twice and doubles the
      // wait the user sees. With a 90s ceiling a timeout means something is
      // genuinely wrong, so surface it instead.
      if (error instanceof Error && error.name === "TimeoutError") {
        throw new Error(
          "The LLM provider did not respond within 90 seconds. Try a narrower question, or a faster model in Setup."
        );
      }

      console.warn(
        `[Copilot] LLM ${path} attempt ${attempt + 1}/${MAX_ATTEMPTS} failed: ${
          error instanceof Error ? error.message : "network error"
        }`
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("The LLM provider could not be reached");
}

async function errorMessageOf(response: Response) {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string } };
    return parsed.error?.message || text;
  } catch {
    return text;
  }
}

/**
 * Learn from a 400 and say whether the same call is worth repeating.
 *
 * Two provider rejections are recoverable and model-specific:
 *   "Unrecognized request argument supplied: reasoning_effort"
 *   "max_tokens is too large: 8000. This model supports at most 4096 …"
 */
function learnFromRejection(model: string, message: string) {
  if (/reasoning_effort/i.test(message) && !noReasoningEffort.has(model)) {
    noReasoningEffort.add(model);
    console.warn(`[Copilot] ${model} does not accept reasoning_effort; retrying without it`);
    return true;
  }

  const cap = message.match(/supports at most (\d+) completion tokens/i);
  if (cap) {
    const limit = Number(cap[1]);
    if (maxTokenCap.get(model) !== limit) {
      maxTokenCap.set(model, limit);
      console.warn(`[Copilot] ${model} caps completion tokens at ${limit}; retrying within it`);
      return true;
    }
  }

  return false;
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const { model } = params;
  const requested = params.maxTokens ?? DEFAULT_MAX_COMPLETION_TOKENS;

  // Two recoverable rejections, so at most two corrective retries.
  for (let attempt = 0; attempt < 3; attempt++) {
    const cap = maxTokenCap.get(model);
    const budget = cap ? Math.min(requested, cap) : requested;
    const payload: Record<string, unknown> = { model, messages: params.messages };

    if (isGptFamily(model)) {
      payload.max_completion_tokens = budget;
      // Keeps hidden reasoning from consuming the whole budget on a reasoning
      // model. Non-reasoning models reject it, which we learn once per model.
      if (!noReasoningEffort.has(model)) payload.reasoning_effort = "low";
    } else {
      payload.max_tokens = budget;
    }

    const response = await request("/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) return (await response.json()) as InvokeResult;

    const message = await errorMessageOf(response);
    if (response.status === 400 && learnFromRejection(model, message)) continue;

    throw new Error(
      `LLM provider returned HTTP ${response.status}: ${redactSecrets(message).slice(0, 500)}`
    );
  }

  throw new Error(`${model} rejected every supported parameter combination`);
}

export async function listLLMModels(): Promise<ModelsResponse> {
  const response = await request("/models", { method: "GET" });
  if (!response.ok) {
    const message = await errorMessageOf(response);
    throw new Error(
      `LLM provider returned HTTP ${response.status}: ${redactSecrets(message).slice(0, 500)}`
    );
  }
  return (await response.json()) as ModelsResponse;
}

/**
 * True when the server has a usable Copilot credential.
 *
 * The App Platform specs ship REPLACE_ME placeholders, and a placeholder is
 * a non-empty string: taken at face value it would report the Copilot as
 * configured and then fail every question with a provider 401. Treating it as
 * absent makes the UI say "not configured on this server" instead, which is
 * the truth and is actionable.
 */
export function isLLMConfigured() {
  const key = ENV.openaiApiKey.trim();
  return key.length > 0 && !key.startsWith("REPLACE_ME");
}
