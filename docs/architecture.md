# Architecture

## Frontend

- Angular 20 (SSR via `@angular/ssr`)
- TypeScript
- Angular Signals (used throughout `src/app/features/**`)
- RxJS

Hosting:
- Vercel

## Backend / API

There is no separate backend service. Content is served two ways from the
same data-access code (`src/content-database.ts`):

- **Vercel serverless functions** in `api/` (e.g. `api/heroes.ts`,
  `api/tier-list.ts`, `api/glossary.ts`) — the production path, each a thin
  handler around `src/vercel-api.ts` + `content-database.ts`.
- **Express**, in `src/server.ts` — serves the same `/api/*` routes for
  local dev / SSR (`npm start`, `npm run serve:ssr:rivals-pulse-coach`), backed
  by `@angular/ssr/node`.

Scheduled content refresh runs via Vercel cron (`vercel.json` `crons`)
hitting `api/sync/home-news.ts`, `api/sync/tier-list.ts`, and
`api/sync/game-stats.ts`. Content is also refreshed manually through the
`scripts/*.mjs` sync scripts (see `package.json` `sync:*` / `refresh:*`).

## Database

- Turso (`@tursodatabase/serverless`, SQLite-compatible), accessed via
  `src/content-database.ts`.
- Schema lives in `scripts/sqlite-schema.sql`; local seed data in
  `data/seeds/*.mock.json`, seeded with `npm run db:seed`
  (`scripts/seed-sqlite.mjs`).

## Authentication

None. There is no login, JWT, or OAuth in this codebase.

## AI Integration

None currently implemented. `docs/coaching-engine.md` and
`docs/prompts/` describe a planned AI-coach feature; no OpenAI or other
LLM API call exists in the codebase yet.

## Monitoring

None currently implemented (no Serilog or equivalent — this is a Node/TS
stack, not .NET).

## Source control / CI/CD

- GitHub, with GitHub Actions CI (`.github/workflows/ci.yml`).
