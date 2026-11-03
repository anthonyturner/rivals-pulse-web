# Architecture

## Frontend

- Angular 20
- TypeScript
- Angular Signals (used throughout `src/app/features/**`)
- RxJS

Rendering: every page is rendered on the server (`@angular/ssr`, `src/server.ts`),
locally by `npm start` and `npm run serve:ssr:rivals-pulse-coach` and in production
by a Vercel function. `vercel.json` rewrites every path that is neither a static file
nor under `/api/` to `api/ssr.mjs`, which re-exports `reqHandler` from the built
`dist/rivals-pulse-coach/server/server.mjs` (the function ships that folder through
`includeFiles`). Static files in the build output are still served from the CDN. A `curl`
of a page returns the rendered HTML, with its title and meta tags. Routes that need
the visitor's own session (`/sign-in`, `/account`, `/profile`) are declared
`RenderMode.Client` in `src/app/app.routes.server.ts`, so they answer the browser
shell.
The not-found page answers HTTP 404 from the server render (`respondNotFound()` in
`core/seo/response-status.ts`, which sets the status on Angular's `RESPONSE_INIT`),
and a guide route whose id is unknown falls through to it (`knownIdGuard` in
`core/navigation/`).

Two settings make the server render work behind Vercel, and without either it
quietly falls back to the browser shell and answers 200 for everything:

- **Allowed hosts.** Angular refuses a request whose host it has not been told
  about. `projects.*.architect.build.options.security.allowedHosts` in `angular.json`
  lists `rivalspulse.com`, `www.rivalspulse.com`, `*.vercel.app` (previews) and
  `localhost`; the list is compiled into the server build. To allow another
  host, add it there, or set the `NG_ALLOWED_HOSTS` environment variable
  (comma-separated), which Angular reads first.
- **Proxy headers.** Vercel adds `X-Forwarded-For` and the other `X-Forwarded-*`
  headers, which Angular only accepts from a proxy it trusts. `src/server.ts` sets
  `trustProxyHeaders` when Vercel's `VERCEL` environment variable is present.

During a server render the app's own `/api/*` requests go back to the same host,
so each uncached page view can also invoke the API functions (the HTTP transfer cache
skips `/api/` requests, so the browser asks again). A Vercel preview behind
Deployment Protection answers those requests with a login page, and the page then
renders without its API data.

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

### Server code layout

The server code lives in `src/server/<feature>/`, one folder per feature
(`account`, `auth`, `community`, `content`, `heroes/*`, `http`, `pulse-atlas`,
`supabase`, `sync`). Inside a folder, a pure derivation module (for example
`hero-matchups.ts`) sits beside the module that reads the database for it
(`hero-matchups-read.ts`).

- **Import a feature through its `index.ts`.** `api/`, the `scripts/*.mjs`
  sync scripts and other features import `../heroes/matchups/index.ts`, and
  `src/server.ts` imports the folder (`./server/heroes/matchups`), never the
  files behind it, so splitting or
  merging files inside a feature edits that feature only. A type-only import is
  the one exception, since it is erased at compile time. The entry point lists
  what code outside the folder uses and nothing more; an export that nothing
  outside its own file (or that file's spec) uses is not exported.
- **Relative imports under `src/server` and `api/` name the `.ts` file.**
  `src/app` and `src/server.ts`, which only Angular's build compiles, stay
  extensionless. Node loads the scripts and the
  function tests through type stripping, which does not map `.js` to `.ts`.
  `rewriteRelativeImportExtensions` in `tsconfig.json` turns the specifiers
  into `.js` when the compiler emits. `tsconfig.api.json` adds
  `erasableSyntaxOnly` and `verbatimModuleSyntax`, so a module the `api/`
  functions reach cannot use syntax that stripping rejects (parameter
  properties, enums) or import a type without `import type`. Modules only the
  scripts reach (`pulse-atlas`) are not covered by that check.
- **A pure module the browser reuses stays importable by file.** The app
  specs import `heroes/stats/hero-stats.ts` and `account/own-dashboard.ts`
  (which imports `heroes/catalog/hero-game-ids.ts`). An entry point also pulls
  in Supabase code, which must never reach the browser (the CI step
  `npm run check:browser-bundle` fails if it does), so nothing under `src/app` imports an
  `index.ts`, and a pure module (`hero-matchups.ts`, `hero-pairs.ts`,
  `community-matches.ts` and the three above) imports other pure modules by
  file. The `hero-stats` and `account` entry points leave their pure module
  out for the same reason.
- **A sync job lives with the content it feeds** (`content/home/home-news-sync.ts`),
  unless it feeds several areas, in which case it lives in `sync/`
  (`sync/game-stats-sync.ts`).
- **Specs import the files they test.** Spec files and the `supabase/functions`
  tests are exempt from the entry-point rule. `pulse-atlas` has no entry point
  because only `scripts/build-pulse-atlas.mjs` uses it.

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
