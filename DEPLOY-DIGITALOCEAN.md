# Deploying IOPAF to DigitalOcean App Platform

Prepared from package checkpoint `2a9eb945`. Everything below was verified
locally on Windows with Node 24 and pnpm 10.4.1.

## What was changed from the original package

| Change | File | Why |
|---|---|---|
| Honour `$PORT` verbatim | `server/_core/index.ts` | The original scanned for a free port. App Platform health-checks on `$PORT` exactly, so a scan can bind a port nothing is probing and the deploy fails with no clear cause. Also now binds `0.0.0.0`. |
| Removed 6 unused Forge modules | `server/_core/` | `llm`, `map`, `imageGeneration`, `dataApi`, `heartbeat`, `voiceTranscription` — zero imports anywhere. They require Manus Forge credentials unavailable off-platform. `tsc --noEmit` passes without them. |
| Added App Platform spec | `.do/app.yaml` | App + managed MySQL 8, pnpm build command, health check. |

`storageProxy` and `notification` were **kept** — each has one importer, and both
fail safely at request time rather than at boot.

## Verified locally

- `pnpm install --frozen-lockfile` — succeeds (`vite-plugin-manus-runtime` is public on npm)
- `tsc --noEmit` — clean
- `pnpm build` — succeeds; `dist/public/app.html` is byte-identical to source (`fa7269bc…`)
- `PORT=8080 node dist/index.js` — binds 8080 exactly, logs `Server running on port 8080`
- `GET /` → 200, `GET /app.html` → 302 (auth guard active)
- Boots without a database: logs a clear OAuth error but does not crash, so the health check still passes

## Still required before it works end to end

**Authentication.** The Manus OAuth endpoints will not function off-Manus.
`server/_core/sdk.ts` is the seam — three methods:

- `exchangeCodeForToken(code, state)`
- `getUserInfo(accessToken)`
- `authenticateRequest(req)`

Everything around it is standard and stays: the callback route, the CSRF nonce
check, session cookie handling, and the `/app.html` guard in `portalAccess.ts`.

Until this is replaced, the site deploys and the public pages render, but nobody
can sign in and `/app.html` stays behind a 302.

## Deploy steps

1. Push this folder to a Git repository.
2. Edit `.do/app.yaml` — set `github.repo`, the `region`, and every `REPLACE_ME`.
3. `doctl apps create --spec .do/app.yaml`
4. Set `JWT_SECRET` as an encrypted secret in the dashboard (or in the spec as `type: SECRET`).
5. Apply the schema: `drizzle/0000_magenta_captain_universe.sql`, or `pnpm db:push` after review.

`DATABASE_URL` binds automatically from the managed MySQL component via
`${iopaf-db.DATABASE_URL}` — no manual connection string needed.

## Cost — two specs provided

| Spec | Contents | Cost |
|---|---|---|
| `.do/app.yaml` | App only, `apps-s-1vcpu-0.5gb` | **~$5/month** |
| `.do/app-with-database.yaml` | App + managed MySQL 8 | ~$20/month |

Start with `app.yaml`. `server/db.ts` creates the connection lazily and returns
`null` when `DATABASE_URL` is absent; callers log a warning instead of throwing,
so the app runs correctly with no database. Since the schema holds user accounts
only, and sign-in cannot work until Manus OAuth is replaced, the database buys
nothing until auth is live.

Both specs pass `doctl apps spec validate`.

Note: the $5 tier is 512 MB RAM. Serving static files through Express fits
comfortably; if you later add server-side work, move up a size.

## Important limitation

The database stores **user accounts only**. Assessment answers remain in each
browser's `localStorage`, exactly as before — the package README states this
explicitly. This deployment gives you a public site and a login gate. It does not
give you shared assessments, server-side evidence storage, or consolidated
reporting.
