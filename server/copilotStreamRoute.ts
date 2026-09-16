import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { isLLMConfigured, redactSecrets, streamLLM, type Message } from "./_core/llm";
import {
  buildAllowedCopilotContext,
  buildCopilotSystemPrompt,
  chatInputSchema,
  enforceRateLimit,
  settingsForOpenId,
  trimConversation,
} from "./routers/copilot";

/**
 * Streaming Copilot chat.
 *
 * The tRPC mutation returns the whole answer at once, which means the user
 * stares at a spinner for as long as the model takes — 5.5s for a single
 * sentence from a reasoning model, over thirty for a full answer. This route
 * sends the same answer as it is produced, so reading starts almost
 * immediately.
 *
 * It is a plain Express route rather than a tRPC procedure because tRPC's
 * response is a single JSON body; server-sent events need the connection held
 * open. Every guarantee the mutation enforces is enforced here too, by calling
 * the same functions: session cookie, schema validation, rate limit, and the
 * privacy filter that decides what may leave the server. Nothing about this
 * path is more permissive.
 */
export function registerCopilotStreamRoute(app: Express) {
  app.post("/api/copilot/stream", async (req: Request, res: Response) => {
    let user: Awaited<ReturnType<typeof sdk.authenticateRequest>>;
    try {
      user = await sdk.authenticateRequest(req);
    } catch {
      res.status(401).json({ error: "Please sign in" });
      return;
    }

    if (!isLLMConfigured()) {
      res.status(412).json({
        error: "The AI Copilot is not configured on this server. Contact your administrator.",
      });
      return;
    }

    const parsed = chatInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid request" });
      return;
    }

    try {
      enforceRateLimit(user.openId);
    } catch {
      res.status(429).json({
        error: "Copilot request limit reached. Please wait a minute and try again.",
      });
      return;
    }

    const settings = await settingsForOpenId(user.openId);
    if (!settings.enabled) {
      res.status(403).json({ error: "IOPAF Copilot is disabled in Setup" });
      return;
    }

    const context = buildAllowedCopilotContext(
      parsed.data.context,
      settings.includeCurrentResponse,
      settings.includeRemediation
    );
    const messages: Message[] = [
      { role: "system", content: buildCopilotSystemPrompt(context) },
      ...trimConversation(parsed.data.messages).map(m => ({ role: m.role, content: m.content })),
    ];

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Connection", "keep-alive");
    // Tells Cloudflare and any nginx in front not to buffer, which would
    // reassemble the stream and reintroduce exactly the wait this removes.
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const send = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    // If the reader navigates away mid-answer, stop pulling from the provider.
    let aborted = false;
    req.on("close", () => {
      aborted = true;
    });

    let produced = 0;
    try {
      for await (const delta of streamLLM({ model: settings.model, messages })) {
        if (aborted) return;
        produced += delta.length;
        send("delta", { text: delta });
      }

      if (produced === 0) {
        // A reasoning model that spends its whole budget thinking returns a
        // stream with no visible tokens. Say which model, as the non-streaming
        // path does, rather than showing an empty answer.
        send("error", {
          message: `${settings.model} produced no answer. Ask a narrower question, or choose a different model in Setup.`,
        });
      } else {
        send("done", { model: settings.model, chars: produced });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "The Copilot request failed";
      console.warn(`[Copilot] stream failed after ${produced} characters`);
      // Mid-stream there is no status code left to set, so the failure is part
      // of the stream. Redacted, like every other provider error.
      send("error", { message: redactSecrets(message).slice(0, 280) });
    } finally {
      res.end();
    }
  });
}
