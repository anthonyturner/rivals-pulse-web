# Architecture

## Frontend

- Angular 20
- TypeScript
- Angular Signals (used throughout `src/app/features/**`)
- RxJS

Rendering: production pages are server-rendered, so a `curl` of a page returns
its own text, title, description and canonical. `vercel.json` rewrites every
non-API path that is not a static file to `api/ssr.mjs`, a Vercel function that
hands the request to the Angular server render (`@angular/ssr`, `src/server.ts`;
the same code serves local dev and `npm run serve:ssr:rivals-pulse-coach`).
Vercel serves a real file (`ads.txt`, hashed bundles, images) before any
rewrite, so static files never reach the function. The browser shell must
not be one of them, or `/` would be served as a file: `npm run vercel:build`
copies the browser build into `dist/rivals-pulse-coach/static` without
`index.csr.html` (and `index.html`), and `vercel.json` serves that folder, while the
function keeps reading the shell from the real build folder. A page the server must not
render is declared `RenderMode.Client` in `src/app/app.routes.server.ts` and gets
the empty browser shell: `/sign-in`, `/account`, `/profile` and `/admin` (the
visitor's own session) and the Pulse Records lists, `/stats/records` (no player name in server HTML).

- **Hosts.** The render answers only the hosts in `security.allowedHosts` in
  `angular.json` (the site, `www`, `*.vercel.app`, `localhost`). A request for any
  other host gets a 400, so a new domain left off that list is a full outage: add
  it there before pointing the domain here. The render takes its host from the
  `Host` header; `src/server.ts` removes every `x-forwarded-*` header except
  `x-forwarded-for` and `x-forwarded-proto` first (`src/server/ssr/proxy-headers.ts`),
  because Angular answers the empty shell to one it was not told to trust.
- **Time budget.** `renderWithinBudget` (`src/server/ssr/`) gives a render eight
  seconds. A data page whose API never answers, or a render that throws, is
  answered with the browser shell (`index.csr.html`) instead of hanging, and that
  shell is never cached. A finished render is cached by the CDN for five minutes
  (`s-maxage=300`), unless one of its `/api` requests failed: then the page shows
  its error state, and `uncachedOnFailedRequestInterceptor`
  (`core/seo/`) sets `no-store` on the response so that state is not kept.
- **Data in the render.** A page's `/api/*` requests go to its own host, so each
  one is a second function call (cached by the CDN like any API answer). A page
  whose request fails draws its error state, is not cached, and, if it reports no
  content state of its own, counts as thin (no ad, `noindex`).
- **404.** The not-found page answers HTTP 404 from the server render
  (`respondNotFound()` in `core/seo/response-status.ts`, which sets the status on
  Angular's `RESPONSE_INIT`), and a guide route whose id is unknown falls through
  to it (`knownIdGuard` in `core/navigation/`). That status reaches production
  now that the server render runs there.

Stats hub: `/stats` is one page (`features/stats/stats-page`) with a child route per tab
(`stats.routes.ts`, tabs listed in `stats-tabs.ts`: Overview, Heroes, Roles, Matchups, Maps,
Team comps, Records). The tab bar is a nav of links with `aria-current`, not a script-driven
tab list, so every tab is a page a crawler can follow; each tab sets its own title,
description (route `data`) and canonical. A tab is a view with no page around it: Overview
draws game stats and the community matches and insights tabs, Roles and Matchups are the
community stats and counters tabs, Team comps is `TeamCompsComponent`, and Records is one
page with a category filter held in `?category=`. Heroes shows the community hero numbers (most
picked, highest win rate, per-minute damage, healing and damage blocked) above every hero's record,
as a Table (the win-rates table, with search, role filter and sort) or as Tiers (the tier list). The
layout, half-season and mode are in the address (`?view=tiers&season=10&mode=competitive`, each left
out when it is the default), so each can be linked and is drawn by the server; the toggle is two plain
links that keep the other choices. `StatsHeroesComponent` owns the choices and the request (the
default cut is the shared `CurrentHeroStatsService`, any other is `HeroStatsService`), and hands the
numbers to `HeroTableComponent` or `HeroTiersComponent`, which draw them. The tab is thin only when
the number sections and the layout in view all are. Maps lists every map from the same `/api/community/matches` answer the Overview reads, and is thin
(no ad, `noindex`) until one map has a win rate.

Navigation and moved addresses: the top bar lists Heroes, Stats, Guides and Tools
(`core/layout/nav/primary-nav.ts`). Stats is `/stats` and every page under it; Resources has no
item of its own, so its hub and the pages in it sit under Guides, and `/resources` is linked from the Guides page and the
footer. The old stat addresses (`/community` and its tabs, `/game-stats`, `/team-comps`,
`/records` and its lists, `/tier-list` to the Heroes tab's Tiers layout, `/win-rates` and anything
under it, and `/season-9-win-rates` to the Heroes tab) are redirected to their hub tab. `core/navigation/legacy-redirects.ts` is
the one list; `legacy-redirect.routes.ts` turns it into router redirects (so the dev server and
in-app navigation behave, and the server answers a temporary one), and `vercel.json` holds the
same list as `permanent: true` redirects, which Vercel answers with a 308 before the app runs and
is what crawlers see. `scripts/legacy-redirects.test.ts` fails when the two lists differ. A moved
address stays out of the sitemap and gets no `RenderMode` rule. Internal links point straight at
the new address, so none goes through a redirect.

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
  local dev, the local server render (`npm start`,
  `npm run serve:ssr:rivals-pulse-coach`), backed by `@angular/ssr/node`.

Scheduled content refresh runs via Vercel cron (`vercel.json` `crons`)
hitting `api/sync/home-news.ts`. Content is also refreshed manually through the
`scripts/*.mjs` sync scripts (see `package.json` `sync:*` / `refresh:*`).

### Server code layout

The server code lives in `src/server/<feature>/`, one folder per feature
(`account`, `auth`, `community`, `content`, `heroes/*`, `http`, `pulse-atlas`,
`ssr`, `supabase`, `sync`). Inside a folder, a pure derivation module (for example
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
  `index.ts`, and a pure module (`hero-matchups.ts`, `hero-pairs.ts`
  and the three above) imports other pure modules by
  file. The `hero-stats` and `account` entry points leave their pure module
  out for the same reason.
- **A sync job lives with the content it feeds** (`content/home/home-news-sync.ts`),
  unless it feeds several areas, in which case it lives in `sync/`.
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
  `/api/account/*`, which are written once in `src/server/account/account-api.ts` (with the request, session and
  Origin helpers the admin routes share in `account-session.ts`) and mounted by
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
- Site administration (issue 290, [ADR-0005](decisions/0005-gate-site-administration-behind-an-admin-table.md)): an administrator is a row in
  `public.admins`, put there by the owner by hand ([supabase.md](supabase.md), "The site administrator role"). Signed in never
  means admin: the database function `public.is_admin()` is the only test. `/api/admin/*` is served by one wrapper
  (`src/server/admin/`) that answers 401, 403 and `private, no-store` for every route in `ADMIN_ROUTES`, mounted in Express
  as the whole prefix and as one file per route under `api/admin/`. In the browser, `adminGuard` (a `canMatch` guard) and the
  Admin link read `isAdmin` from the session answer, and the lazily loaded `/admin` area (`src/app/features/admin/`, menu and
  routes from `ADMIN_PAGES`) is client-rendered and carries `robots: noindex, nofollow`. Those are conveniences; the API and
  the database are what refuse.
- Search crawlers: `public/robots.txt` is a static file; `sitemap.xml` is written into the browser build by `scripts/write-sitemap.ts` (the last step of `npm run build`) from `src/app/core/seo/sitemap.ts`, the hero roster from the content API (the seed file if it cannot be read) and the guide data. `vercel.json` sets both files' content types. `sitemap.spec.ts` fails when a route is in neither the sitemap nor its exclusion list (issue 764).
- The admin "Data jobs" page (issue 494) runs the five hourly rebuilds and the home news sync on demand through `admin/data-jobs` and
  `admin/data-jobs-run`: a database call under the admin's own token writes the audit row and checks the cooldown, then a rebuild
  runs in the database and a sync runs in `src/server/admin/sync-jobs.ts`, the one place the admin area uses the service-role key
  (ADR-0005, decision 6). See "Running the data jobs on demand" in [supabase.md](supabase.md).
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
  records, recent matches, and the activity tables from `own-activity.ts`) and only those reach the browser. A blank figure is `null`, never 0. There is no
  service key and no per-account copy of the data. The `/profile` page (`src/app/features/profile/`) asks it through `AuthService.loadDashboard()`, which validates the answer, and `buildProfileView` turns it into the
  states the page draws (not linked, no matches, unavailable, ready). Its ready state includes the My matches and My insights tables (`own-activity/`). The Stats overview's Matches and Insights sections
  are separate: they read the anonymous `/api/community/matches` and `/api/community/insights` and never the dashboard.
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
