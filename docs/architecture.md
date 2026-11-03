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
without it. Routes that need the visitor's own session (`/sign-in`, `/account`, `/profile`)
are declared `RenderMode.Client` in `src/app/app.routes.server.ts`.

Hosting:
- Vercel

## Backend / API

There is no separate backend service. Content is served two ways from the
same data-access code (`src/server/content/content-database.ts`):

- **Vercel serverless functions** in `api/` (e.g. `api/heroes.ts`,
  `api/hero-stats.ts`, `api/glossary.ts`) — the production path, each a thin
  handler around `src/server/http/vercel-api.ts` + `content-database.ts`. Vercel serves a
  file under `api/` only at its own path, so every route needs its own file;
  there is no catch-all.
- **Express**, in `src/server.ts` — serves the same `/api/*` routes for
  local dev and the local server render (`npm start`,
  `npm run serve:ssr:rivals-pulse-coach`), backed by `@angular/ssr/node`.

Scheduled content refresh runs via Vercel cron (`vercel.json` `crons`)
hitting `api/sync/home-news.ts` and `api/sync/game-stats.ts`. Content is also refreshed manually through the
`scripts/*.mjs` sync scripts (see `package.json` `sync:*` / `refresh:*`).

## Database

- Turso (`@tursodatabase/serverless`, SQLite-compatible), accessed via
  `src/server/content/content-database.ts`.
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
  `/api/account/*`, which are written once in `src/server/account/account-api.ts` and mounted by
  both Express (`src/server.ts`) and the Vercel functions (one file per route under `api/auth/` and `api/account/`)
  through `src/server/account/account-http.ts`.
- The session is the `rp_session` cookie (`HttpOnly; Secure; SameSite=Lax;
  Path=/api`), holding the access and refresh tokens. Sign-in is a PKCE
  (one-time secret) flow whose verifier waits in the short-lived `rp_pkce`
  cookie. `src/server/auth/auth-gateway.ts` calls Supabase Auth with plain `fetch` and the
  publishable key plus the user's own token, so row-level security decides what a
  call may touch.
- Every auth and account answer is `Cache-Control: private, no-store`, a POST
  with a missing or foreign `Origin` is refused, and Discord sign-in works on
  `rivalspulse.com` and `localhost` only (a Vercel preview shares the live
  Supabase project, so it gets none).
- The browser asks `GET /api/auth/session` through `AuthService`
  (`src/app/core/auth/`) and the `/account` and `/profile` routes are guarded by `signedInGuard`.
- `public.profiles` (one row per account, RLS on) is created at first sign-in.
- An account can be linked to an in-game player with a one-time code (issue 264). The desktop app asks
  the Edge Function `issue-link-code` for a code, proving who it is with its Overwolf session; the
  player types it on the account page, `POST /api/account/link` calls the `redeem_link_code` database
  function with the player's own token, and `public.player_links` (RLS: the owner reads, only the
  functions write) holds the result. The link rests on the verified Overwolf identity, never on the name
  or uid, which are the app's claims and are only displayed. `GET /api/auth/session` returns
  `player: { name, avatarUrl } | null`, and `Nav` shows the name and Overwolf avatar instead of
  "Account" when it is set. The website holds no service key and no `RECORDER_ID_SECRET` for this.
- `GET /api/account/dashboard` (issue 329) calls the `read_own_dashboard` database function with the player's
  own token. The database picks the lines (those whose recorder and uid are the link's own, newest 2,000);
  `src/server/account/own-dashboard.ts` derives the figures (results, K/D/A, final hits, top heroes, per-minute figures,
  records, recent matches) and only those reach the browser. A blank figure is `null`, never 0. There is no
  service key and no per-account copy of the data. The `/profile` page (`src/app/features/profile/`) asks it
  through `AuthService.loadDashboard()`, which validates the answer, and `buildProfileView` turns it into the
  states the page draws (not linked, no matches, unavailable, ready).
- The desktop app also has its own link calls, each an Edge Function that confirms the Overwolf session:
  `refresh-linked-player` (refresh the name and avatar), `link-status` (am I linked, and as whom) and
  `unlink-player-app` (remove the link). They act only on the verified session's own link and never return the
  website account's email or id; see "The app's own calls about its link" in [supabase.md](supabase.md).
- The session cookie also carries the time of the Discord sign-in (Supabase moves its own
  `last_sign_in_at` on every token refresh, so it cannot be used). `POST /api/account/delete` needs that
  sign-in to be under ten minutes old (ADR-0004, decision 7) and answers 401 with a reason otherwise.
- `POST /api/account/delete` verifies the session with Supabase (`auth.getUser`), requires the typed
  phrase and the "account" mode, then deletes the auth user with the service-role key, which the server
  uses for this call only. The profile row goes with it (`on delete cascade`) and the session cookie is
  cleared. The account page offers only that mode (it says forgetting uploaded matches is not available
  yet); the server still refuses "Remove account and forget me" until that is built.


## AI Integration

None currently implemented. `docs/coaching-engine.md` and
`docs/prompts/` describe a planned AI-coach feature; no OpenAI or other
LLM API call exists in the codebase yet.

## Monitoring

None currently implemented (no Serilog or equivalent — this is a Node/TS
stack, not .NET).

## Source control / CI/CD

- GitHub, with GitHub Actions CI (`.github/workflows/ci.yml`).
