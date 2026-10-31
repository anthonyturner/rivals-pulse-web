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
  `api/hero-stats.ts`, `api/glossary.ts`) — the production path, each a thin
  handler around `src/vercel-api.ts` + `content-database.ts`.
- **Express**, in `src/server.ts` — serves the same `/api/*` routes for
  local dev / SSR (`npm start`, `npm run serve:ssr:rivals-pulse-coach`), backed
  by `@angular/ssr/node`.

Scheduled content refresh runs via Vercel cron (`vercel.json` `crons`)
hitting `api/sync/home-news.ts` and `api/sync/game-stats.ts`. Content is also refreshed manually through the
`scripts/*.mjs` sync scripts (see `package.json` `sync:*` / `refresh:*`).

## Database

- Supabase (hosted Postgres) is the only database
  ([ADR-0004](decisions/0004-keep-all-web-data-in-supabase.md)). It holds the
  web content and the overlay's match uploads. Server code reaches it through
  `src/supabase-client.ts` with `@supabase/supabase-js`; the per-domain stores
  (for example `src/hero-store.ts`) sit behind `src/content-database.ts`.
- Schema lives in `supabase/migrations/`, beside the Edge Functions and
  `config.toml`; local seed data in `data/seeds/*.mock.json`, seeded with
  `npm run db:seed`. See [supabase.md](supabase.md) for how migrations reach
  the live project.

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
