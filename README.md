# KOLSS CRM — Angular frontend

CRM frontend for KOLSS. Angular 22 (standalone components, signals, zoneless), TypeScript 6
(strict mode), SCSS, Vitest + jsdom for unit tests. See [AGENTS.md](AGENTS.md) and
[best-practices.md](best-practices.md) for the full stack description and the project's Angular/
TypeScript conventions (both are canonical — read them before contributing).

## Commands

| Command                      | Purpose                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| `npm start`                  | Dev server (`ng serve`), regenerates `environment.local.ts` first |
| `npm run build`              | Production build, regenerates `environment.prod.ts` first         |
| `npm test`                   | Unit tests (Vitest via the Angular test builder)                  |
| `npm run lint`               | ESLint (TypeScript + templates)                                   |
| `npm run format`             | Auto-format with Prettier                                         |
| `npm run format:check`       | Check formatting without writing                                  |
| `npm run check:api-boundary` | Enforce the Supabase/API boundary (see below)                     |
| `npm run check`              | Full validation: API boundary → typecheck → lint → test           |

## Environment configuration

`src/environments/environment.local.ts` (dev) and `src/environments/environment.prod.ts` (prod)
are **generated, not committed** — both are in `.gitignore`. They are produced by
`scripts/sync-env.mjs`, which runs automatically before `npm start` (`prestart`) and
`npm run build` (`prebuild`), or on demand via `npm run sync-env` / `npm run sync-env:prod`.

The script reads from `process.env` first, then falls back to a local `.env.local` file (not
committed), then to hardcoded local-dev defaults (prod mode has no such fallback for secrets and
fails fast instead). Variables:

- `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`) — required in prod mode
- `SUPABASE_ANON_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) — required in prod mode
- `API_BASE_URL` — platform API base URL (defaults to `http://localhost:8080` locally, `https://api.kolss.eu` in prod)
- `SITE_URL` / `SITE_URL_PUBLIC` — optional, fall back to the Vercel URL or a hardcoded default

## API boundary

Supabase is used directly in the browser **only** for authentication/session (see the allow-list
in `scripts/check-api-boundary.mjs`: `core/auth/auth.service.ts`, `core/supabase/supabase.service.ts`,
`core/api/api-auth.interceptor.ts`). All business/CRM data goes through the platform API at
`api.kolss.eu`, via the generated client in `src/app/core/api/generated/`.

`npm run check:api-boundary` (part of `npm run check`) enforces this by scanning `src/app/**/*.ts`
for direct Supabase business-data calls outside the allow-list, and by verifying the generated API
client is pinned to a specific contract version and `sha256` of
`../kolss-platform-api/api/openapi.yaml` (the sibling repo's OpenAPI contract). If that repo isn't
checked out alongside this one, the hash check is skipped; the version pin still applies.

## Known environment quirks

- **Local builds need `CI=1`.** `ng build` without it can abort with exit code 134 while opening
  Angular's persistent LMDB compiler cache on this machine. Use `CI=1 npx ng build` for
  non-watch builds.
- **Focused test runs use `--include`, not `--run`.** The Angular 22 test builder rejects Vitest's
  `--run` flag. Run a single spec with `npm test -- --include <path-or-glob>`.

## Path aliases

TypeScript path aliases (`@core/*`, `@ui/*`, `@features/*`, `@services/*`, `@models/*`, `@env/*`)
map to `src/app/core`, `src/app/ui`, `src/app/features`, `src/app/services`, `src/app/models`, and
`src/environments` respectively (see `tsconfig.json`). Use them for any import that leaves a
component's or service's own folder; same-folder imports stay relative (`./lead-due-date`).

## Further reading

- [AGENTS.md](AGENTS.md) — stack, commands, project layout
- [best-practices.md](best-practices.md) — Angular/TypeScript/testing conventions for this repo
