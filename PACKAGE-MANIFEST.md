# IOPAF Package Manifest

| Included path | Contents |
|---|---|
| `client/` | Public website, protected portal UI, UI components and self-contained engine |
| `server/` | Authentication, protected delivery, tRPC and server implementation |
| `shared/` | Shared types and OAuth state contracts |
| `drizzle/` | Database schema, relations and migration |
| `engine-source/` | Modular engine sources, injector, local PDF dependency, audits and engine tests |
| `reference-assets/iopaf-engine/` | Fourteen curated authentic engine visuals used by the website design |
| `patches/` | Required dependency patch |
| Root TypeScript/configuration files | Build, test, lint and hosting configuration |
| Root Markdown files | Architecture, authentication, QA and package documentation |
| Root test scripts | Browser and portal regression scripts |

## Deliberately excluded

| Excluded path or pattern | Reason |
|---|---|
| `.git/` | Repository history is not required to install the release |
| `node_modules/` | Recreated deterministically with `pnpm install` |
| `dist/` | Recreated with `pnpm build` |
| `.manus-logs/` | Runtime logs may contain environment-specific information |
| `.env*` | Secrets must never be distributed in source archives |
| Python/Node caches | Temporary artifacts |
| Screenshots and downloaded browser traces | QA artifacts not required at runtime |
| `.project-config.json` | Hosting-workspace metadata rather than application source |

The final SHA-256 checksum and file count are recorded in `RELEASE.txt` during package assembly.
