# IOPAF AI Copilot — deployment and operation

**Status:** implementation notes for this repository

The Copilot provides contextual guidance inside the authenticated assessment
portal: it explains the active question, interprets the cited source standard,
suggests evidence, clarifies maturity and Bayesian-risk semantics, and helps
draft remediation. It is advisory only — it never changes a score, an evidence
rating, a risk input or an action.

## How this deployment differs from the upstream specification

`IOPAF-AI-Copilot-Architecture.md` in the Manus web-server package describes
two connection choices: a managed catalogue reached through Manus's private
`forge.manus.im` gateway, and a per-user "bring your own OpenAI-compatible
API" option with server-side encrypted keys.

Neither survives here, deliberately:

| Upstream | This deployment |
|---|---|
| Managed catalogue via `forge.manus.im` + `BUILT_IN_FORGE_API_KEY` | Not reachable off the Manus platform. Replaced by a direct OpenAI-compatible client. |
| Each user registers an endpoint and API key | Removed. One platform provider account serves every signed-in user. |
| `copilotSettings.provider` / `endpoint` / `encryptedApiKey` columns | Do not exist. The row holds no secret. |
| AES-256-GCM key encryption at rest (`copilotSecurity.ts`) | Not needed — no user credential is ever stored. |

The engine's own Setup card (`client/public/app.html`) was patched to match:
the provider selector, HTTPS endpoint, model-ID and API-key inputs are gone.
What remains is the enable switch, the model list and the two privacy toggles.

## Required configuration

| Variable | Scope | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | `RUN_TIME`, **secret** | The one provider credential. Server-only. |
| `OPENAI_BASE_URL` | `RUN_TIME`, optional | Defaults to `https://api.openai.com/v1`. Point at any OpenAI-compatible gateway. |
| `COPILOT_DEFAULT_MODEL` | `RUN_TIME`, optional | Model for users who have never opened Copilot Setup. Defaults to `gpt-5-mini`. |
| `JWT_SECRET` | `RUN_TIME`, secret | Already required for sessions. |
| `DATABASE_URL` | `RUN_TIME` | Already required. The Copilot stores preferences in Postgres. |

Both `.do/app.yaml` and `.do/app-with-database.yaml` declare these.

Without `OPENAI_API_KEY` the platform still runs: the portal loads, the engine
works, and the Copilot reports that it is not configured on this server rather
than failing obscurely.

## Database

Apply `drizzle/0001_copilot_settings.sql` once per environment.

Do **not** reach for `drizzle-kit generate` to produce this. `drizzle/0000`
and `drizzle/meta/_journal.json` are still the pre-port MySQL artefacts from
before the Supabase migration, so drizzle cannot compute a trustworthy
incremental diff against them. That stale journal is worth cleaning up
separately, by baselining the Postgres schema as a fresh `0000`.

The table carries RLS enabled with no policies, matching `users`: reachable
through the server's connection only, never through PostgREST with the
publishable key.

## Privacy boundary

The browser sends only the current conversation plus a normalized, allowlisted
context object. `copilotContextSchema` in `server/routers/copilot.ts` is the
whole contract; anything the iframe sends outside it is stripped server-side.

`buildAllowedCopilotContext` then reduces that again according to the user's
own settings:

| Data | Sent to the model |
|---|---|
| Page, active tab, stream, mode | Always (enumerated values only) |
| Practice / control identifier, title, source reference | Always (current selection only) |
| Current rating, evidence tier, test counts, posterior, credible interval | Only with **Include current ratings…** enabled |
| Remediation text, owner, due date, status | Only with **Include the active remediation text** enabled |
| Attached evidence files | Never |
| Organization, assessor, sponsor names | Never — not in the schema |
| Whole assessment export or localStorage state | Never — not in the schema |
| Provider API key | Never leaves the server |

Every provider error passes through `redactSecrets()` before it can reach a
client, a log line or a `TRPCError`.

## Limits

- 12 chat requests per minute per user, in-process (`rateBuckets`).
  A multi-instance deployment would need a shared store to enforce this
  globally; today each instance counts separately.
- 12 messages per turn, 4,000 characters each.
- Model output capped at 1,600 tokens.
- 45-second provider timeout, 3 attempts with backoff on 408/409/429/5xx.

## Offline behaviour

Opened directly as a file, `app.html` reports **Hosted Copilot unavailable**
and every assessment, persistence, import/export, PDF and risk function
continues to work. The Setup card disables itself and explains why.

## Verifying a deployment

1. `pnpm check` — TypeScript.
2. `pnpm test` — includes `copilotContext.test.ts` (context minimization and
   prompt boundaries) and `copilotCredential.test.ts` (credential redaction).
3. Sign in, open the portal, press **Ask IOPAF**.
4. Open **Setup** in the panel. The model dropdown should populate from the
   provider account; **Test connection** should confirm the selected model.
5. Open an assessment question and use an in-engine AI action. The panel's
   context strip should name that question, and the reply should reflect it.
6. Toggle **Include current ratings…** off, ask about the current score, and
   confirm the model reports that it has not been given one.
