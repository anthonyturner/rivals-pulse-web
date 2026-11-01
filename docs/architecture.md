# Architecture

## Frontend

- Angular 20
- TypeScript
- Angular Signals (used throughout `src/app/features/**`)
- RxJS

Rendering: production pages render in the browser. `vercel.json` rewrites every
non-API path to `index.csr.html`, so a `curl` of a page returns an empty
`<app-root>`. The server render (`@angular/ssr`, `src/server.ts`) runs only for
local dev and `npm run serve:ssr:rivals-pulse-coach`, so a feature must work
without it. Routes that need the visitor's own session (`/sign-in`, `/account`)
are declared `RenderMode.Client` in `src/app/app.routes.server.ts`.

Hosting:
- Vercel

## Backend / API

There is no separate backend service. Content is served two ways from the
same data-access code (`src/content-database.ts`):

- **Vercel serverless functions** in `api/` (e.g. `api/heroes.ts`,
  `api/hero-stats.ts`, `api/glossary.ts`) — the production path, each a thin
  handler around `src/vercel-api.ts` + `content-database.ts`.
- **Express**, in `src/server.ts` — serves the same `/api/*` routes for
  local dev and the local server render (`npm start`,
  `npm run serve:ssr:rivals-pulse-coach`), backed by `@angular/ssr/node`.

Scheduled content refresh runs via Vercel cron (`vercel.json` `crons`)
hitting `api/sync/home-news.ts` and `api/sync/game-stats.ts`. Content is also refreshed manually through the
`scripts/*.mjs` sync scripts (see `package.json` `sync:*` / `refresh:*`).

## Database

- Turso (`@tursodatabase/serverless`, SQLite-compatible), accessed via
  `src/content-database.ts`.
- Schema lives in `scripts/sqlite-schema.sql`; local seed data in
  `data/seeds/*.mock.json`, seeded with `npm run db:seed`
  (`scripts/seed-sqlite.mjs`).

## Supabase

- The overlay upload backend (migrations, Edge Functions) lives in `supabase/`
  and is deployed by hand with the Supabase CLI. The web app does not read from
  it yet. See [supabase.md](supabase.md).

## Authentication

Visitors can sign in with Discord through Supabase Auth ([ADR-0004](decisions/0004-add-player-accounts-private-to-the-owner.md)).
The session lives on the server side of the boundary:

- The browser never holds a Supabase token or loads `@supabase/supabase-js`
  (`npm run check:browser-bundle` enforces it). It calls `/api/auth/*` and
  `/api/account/*`, which are written once in `src/account-api.ts` and mounted by
  both Express (`src/server.ts`) and the Vercel functions (one file per route under `api/auth/` and `api/account/`)
  through `src/account-http.ts`.
- The session is the `rp_session` cookie (`HttpOnly; Secure; SameSite=Lax;
  Path=/api`), holding the access and refresh tokens. Sign-in is a PKCE
  (one-time secret) flow whose verifier waits in the short-lived `rp_pkce`
  cookie. `src/auth-gateway.ts` calls Supabase Auth with plain `fetch` and the
  publishable key plus the user's own token, so row-level security decides what a
  call may touch.
- Every auth and account answer is `Cache-Control: private, no-store`, a POST
  with a missing or foreign `Origin` is refused, and Discord sign-in works on
  `rivalspulse.com` and `localhost` only (a Vercel preview shares the live
  Supabase project, so it gets none).
- The browser asks `GET /api/auth/session` through `AuthService`
  (`src/app/core/auth/`) and the `/account` route is guarded by `signedInGuard`.
- `public.profiles` (one row per account, RLS on) is created at first sign-in.
- The session cookie also carries the time of the Discord sign-in (Supabase moves its own
  `last_sign_in_at` on every token refresh, so it cannot be used). `POST /api/account/delete` needs that
  sign-in to be under ten minutes old (ADR-0004, decision 7) and answers 401 with a reason otherwise.
- `POST /api/account/delete` verifies the session with Supabase (`auth.getUser`), requires the typed
  phrase and the "account" mode, then deletes the auth user with the service-role key, which the server
  uses for this call only. The profile row goes with it (`on delete cascade`) and the session cookie is
  cleared. The "Remove account and forget me" mode is shown disabled and refused by the server until the
  desktop app can be linked to an account.


## AI Integration

None currently implemented. `docs/coaching-engine.md` and
`docs/prompts/` describe a planned AI-coach feature; no OpenAI or other
LLM API call exists in the codebase yet.

## Monitoring

None currently implemented (no Serilog or equivalent — this is a Node/TS
stack, not .NET).

## Source control / CI/CD

- GitHub, with GitHub Actions CI (`.github/workflows/ci.yml`).
