/**
 * Minimal OpenAI-compatible chat client for the IOPAF AI Copilot.
 *
 * The platform holds one provider credential in ENV.openaiApiKey and uses it
 * for every signed-in user, so this module deliberately exposes no way to pass
 * a per-request key or endpoint. Callers get chat completions and the account's
 * model catalogue; nothing else is needed by the Copilot.
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

const REQUEST_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 500;

/** Status codes worth a second attempt: rate limits and transient upstream faults. */
const RETRYABLE_STATUS = new Set([408, 409, 429, 500, 502, 503, 504]);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

      if (response.ok) return response;

      const body = redactSecrets(await response.text()).slice(0, 500);
      lastError = new Error(`LLM provider returned HTTP ${response.status}: ${body}`);

      if (!RETRYABLE_STATUS.has(response.status)) throw lastError;
      console.warn(
        `[Copilot] LLM ${path} attempt ${attempt + 1}/${MAX_ATTEMPTS} failed with HTTP ${response.status}`
      );
    } catch (error) {
      // A thrown non-retryable HTTP error must not be retried.
      if (error === lastError) throw error;
      lastError = error;
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

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const response = await request("/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      max_completion_tokens: params.maxTokens ?? 1600,
    }),
  });

  return (await response.json()) as InvokeResult;
}

export async function listLLMModels(): Promise<ModelsResponse> {
  const response = await request("/models", { method: "GET" });
  return (await response.json()) as ModelsResponse;
}

/** True when the server has a Copilot credential at all. */
export function isLLMConfigured() {
  return Boolean(ENV.openaiApiKey);
}
