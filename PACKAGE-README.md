# IOPAF Complete Source Package

This package contains the complete source for the public IOPAF website, secure account gateway, authenticated application server, database schema, automated tests, and the self-contained IOPAF assessment engine. The packaged release corresponds to website checkpoint **2a9eb945**.

## Package contents

| Component | Location | Purpose |
|---|---|---|
| Public website | `client/src/` | React public website, guided tour, account window and protected portal shell |
| IOPAF engine | `client/public/app.html` | Complete self-contained assessment engine with SDLC, IT Operations and IAM streams |
| Engine rebuild sources | `engine-source/` | Authoritative injected modules, deterministic injector, offline PDF library and engine regressions |
| Curated engine visuals | `reference-assets/iopaf-engine/` | Website-ready authentic engine screenshots retained as reference assets |
| Server | `server/` | Express/tRPC application, OAuth callback, session handling and protected engine delivery |
| Database | `drizzle/` | User schema, relations and reviewed SQL migration |
| Shared contracts | `shared/` | Authentication state, cookie and application constants |
| Tests | `server/*.test.ts`, `test_auth_gateway.py` | Unit and browser validation for authentication and protected engine access |
| Configuration | `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, `tsconfig*.json` | Reproducible development and production builds |
| Documentation | `*.md` | Architecture, authentication, visual specifications and QA evidence |

## Requirements

Use Node.js 22, pnpm 10, and a MySQL-compatible database. The current hosted application uses the platform-provided database, OAuth service and session-secret injection. Do not commit production secrets into source control or add them to this ZIP.

## Environment configuration

The application expects the following runtime values. On Manus hosting these are supplied automatically. For another compatible environment, configure them securely in the host’s secret manager.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | MySQL-compatible database connection |
| `JWT_SECRET` | Session-token signing secret |
| `VITE_APP_ID` | OAuth application identifier |
| `OAUTH_SERVER_URL` | OAuth token and user-information service |
| `VITE_OAUTH_PORTAL_URL` | Secure user sign-in-or-sign-up page |
| `OWNER_OPEN_ID`, `OWNER_NAME` | Application owner metadata |
| `BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY` | Server integration endpoint and credential |
| `VITE_FRONTEND_FORGE_API_URL`, `VITE_FRONTEND_FORGE_API_KEY` | Browser integration endpoint and credential |

The OAuth provider must permit the deployed callback URL: `https://YOUR-DOMAIN/api/oauth/callback`.

## Local setup

1. Extract the ZIP and open a terminal in the top-level `IOPAF-Platform-Complete-2a9eb945` folder.
2. Install dependencies with `pnpm install`.
3. Configure the required environment variables in your secure runtime environment. Never commit an `.env` containing production credentials.
4. Apply `drizzle/0000_magenta_captain_universe.sql` to the configured database, or run `pnpm db:push` after reviewing the generated migration.
5. Start development with `pnpm dev`.
6. Open the local URL printed by the server.

## Validation and production build

Run the checks below before deployment:

```bash
pnpm test
pnpm check
pnpm build
```

The optional browser integration test requires Python Playwright and Chromium:

```bash
python3 test_auth_gateway.py
```

After a successful build, start the production bundle with `pnpm start`. Do not hardcode a port; the server reads the hosting environment.

## Authentication and protected engine access

The public website is available at `/`. Register and Sign in both open the supported secure sign-in-or-sign-up provider screen. Successful verification returns directly to `/portal`. The server also protects `/app.html`, so users cannot bypass the portal shell by opening the engine asset directly.

The IOPAF engine remains a self-contained HTML application. Assessment responses are browser-local unless a user explicitly exports them. The database table in this package stores authenticated user records; it does not contain assessment answers.

The `engine-source/` directory is included for maintainers who need to rebuild or independently audit the self-contained HTML. Run its deterministic injector and regressions from that directory; the deployed website itself requires only `client/public/app.html` at runtime.

## Deployment note

The project is configured for Manus built-in hosting, authentication and custom domains. Deploying unchanged to an unrelated host may require replacing the platform OAuth and environment integrations. The permanent hosted website is `https://iopafapp-ewztyczz.manus.space`.

## Security exclusions

The ZIP deliberately excludes `.env*`, `.git`, `node_modules`, `dist`, `.manus-logs`, caches, screenshots and temporary artifacts. No secret values or database data are included.

## Attribution

IOPAF is developed by **Shabir Murtaza (MSc & PhD – Transformation & Innovation)**. The assessment framework remains a draft for review and pilot use; content, scoring rules and mappings may change.
