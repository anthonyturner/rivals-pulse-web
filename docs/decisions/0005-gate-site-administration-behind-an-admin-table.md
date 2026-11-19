# ADR-0005: Gate site administration behind an admin table and a database check

- **Status:** Accepted on 2026-11-04. It was Proposed on 2026-11-01. Decision 6 was amended on 2026-11-05
  for the two sync jobs (issue 494).
- **Date:** 2026-11-04 (proposed 2026-11-01)
- **Deciders:** Anthony (maintainer). Proposed from the engineering refinement
  of #290 (approach A1). He asked for the admin area on 2026-11-04, which
  accepts it; #290 builds it. When #270 merged, the assumptions below about what
  it delivers were checked against the code and corrected in place; the open
  questions say how each came out.
- **Related:** epic #289; this issue #293; #290 (admin role and gated admin
  area), #291 (spike on `pg_cron`), #292 (refresh schedule page), #494 (run the
  data jobs on demand). Builds on
  #270 (account foundation and Discord sign-in) and
  [ADR-0004](0004-add-player-accounts-private-to-the-owner.md).

## In plain words

The site owner wants a private area where site settings, such as how often the
background data refresh jobs run, can be changed without a deploy. Anyone can
create an account on a public site, so "signed in" cannot mean "allowed in".
This record says how the owner is marked as an administrator, and how every
admin screen and every admin request is refused to everyone else: by the server
and by the database, not by hiding a link. The owner grants and removes admin
by hand. There is no sign-up route to it.

## Context

**What is true today**

- #270 built sign-in, and this record was checked against what it delivered.
  The session is a server-held cookie the page cannot read (`src/server/auth/`).
  The account routes are written once (`src/server/account/`), mounted in Express
  (`src/server.ts`) and as one Vercel function per route under `api/`. Supabase is
  called per request with plain `fetch`, the publishable key and the user's own token
  (`AuthGateway` in `src/server/auth/auth-gateway.ts`; there is no per-request
  supabase-js client), so row-level security (RLS, the database rules about who may
  read which row) is the real guard. Every POST has an `Origin` check and every
  answer is `private, no-store`. Before #290 `admin` appeared nowhere in code,
  migrations or docs.
- Anyone can register, so the `authenticated` database role no longer means
  "trusted" (ADR-0004, Consequences: "Sign-up is open to anyone on a public
  site ... no new grant may assume otherwise"). A check that only asks "is this
  user signed in?" would admit every stranger who registers.
- The content routes accept only GET and answer anything else with 405
  (`src/server/http/vercel-api.ts:36-39`). The account routes take POST (#270),
  and the admin routes use the same request handling, so admin changes can POST.
- Default API answers are cached by the CDN (the shared web cache) for five
  minutes, and a stale copy may be served for up to an hour
  (`src/server/http/vercel-api.ts:5`). A route that forgets to
  override that would hand one visitor's answer to the next. A `no-store`
  variant exists for a single content route (`api/home/content.ts:11`); the account
  routes set `private, no-store` where they write their answer (`respondPrivately` in
  `src/server/account/account-http.ts`).
- The database already has a posture for data the website alone may touch: RLS
  on, no policy, and all rights revoked from `anon` and `authenticated`
  (`supabase/migrations/20261030000000_hero_aggregates.sql:84-91`). Functions
  that are allowed through that wall run as their owner (security definer) and
  are granted narrowly (`supabase/migrations/20261030050000_hero_stats_read.sql`,
  `docs/supabase.md`, "Reading the hero aggregates").
- The frozen overlay objects stay frozen: additive changes only
  (`docs/supabase.md`, "Frozen for shipped overlays").
- The repository cannot run SQL in tests today. There is no pgTAP, no
  `supabase start` and no Postgres service in the repo or CI
  (`supabase/functions/track-match-history/extended-migrations.test.ts:5-10`).
- The site has no sitemap and no `robots.txt`. `PageMetaTitleStrategy`
  (`src/app/core/seo/page-meta-title.strategy.ts`) sets the title and the link
  preview tags on every route and has no per-route "do not index" setting.

**Why doing nothing is not an option.** The first admin page (#292) changes how
often background jobs run, and later pages will change more. Without an agreed
design, each admin issue would re-argue who counts as an admin, where that is
checked, and how answers are kept out of the cache.

## Decision

**1. Admins are rows in a table.** We will add `public.admins`, with `user_id`
referencing `auth.users` (`on delete cascade`), `granted_at` and `note`. RLS is
on, there is no policy, and `anon` and `authenticated` hold no grant on it, the
same posture as the other website-only tables (Context). The service role is
revoked too, which the other tables do not do, so the website's service key cannot
read or write it (decision 6). Nothing reads the table except the check below.

**2. One database check.** We will add `public.is_admin()`, a security-definer
function (runs with its owner's rights, with `search_path` set to empty as the
existing read functions do) that returns whether `auth.uid()` is in
`public.admins`. It is granted to `authenticated` and to nobody else: the
migration revokes execute from `public` and `anon` first, because Postgres lets
`public` run a new function by default. Every
admin-only table and every admin-only function reaches its data only after
`is_admin()` returns true; a function that skips it is a defect. The database is
the only layer every path goes through, so this is the real gate. Everything in
the browser and the API is a convenience on top of it.

**3. Admin is granted and revoked by hand, by the owner.** The owner inserts or
deletes a row in `public.admins` with SQL run against the linked project.
There is no sign-up path, no self-service request and no admin-grants-admin
screen. #290 writes the exact steps into `docs/supabase.md`. Revoking takes
effect on the admin's next request, because the check reads the table every time
and nothing is kept in the token. Deleting the admin's account removes the row
too, through the cascade; that is intended.

**4. Signed in never implies admin.** No admin decision may rest on "has a
valid session", on `authenticated`, on an email address, or on anything the
browser says about itself. The only test is `is_admin()` (ADR-0004: the
`authenticated` role is not trusted).

**5. One wrapper for every admin answer.** Every `/api/admin/*` handler goes
through a single wrapper that:

- answers 401 when there is no session, and 403 when the session is not an
  admin's (the wrapper asks `is_admin()` once, with the request's own session,
  through `AuthGateway.isAdmin`). Both refusals come before the route is looked
  up, so on Express a caller who is not an admin cannot tell a real route from a
  made-up one. On Vercel an address with no file under `api/admin/` never reaches
  the wrapper and gets Vercel's own 404, so the existence of a route file is not
  hidden there; the files are in the public source anyway, and what a route does
  stays behind the refusals;
- answers 503, never 403, when the database cannot say, so an outage is not
  mistaken for a refusal;
- sends `Cache-Control: private, no-store` on every answer, including errors and
  refusals, because the writer it shares with the account routes
  (`respondPrivately`) sets it;
- is the only way an admin route is registered: `ADMIN_ROUTES` lists the routes,
  Express mounts the whole `/api/admin/` prefix through the wrapper, and each
  Vercel file under `api/admin/` only hands its route to it. A test fails when a
  file and the list disagree or when a file does anything else.

Admin POSTs also get #270's `Origin` check.

The browser learns whether it may show the Admin link from an `isAdmin` field on
the session answer (`GET /api/auth/session`), read from the same `is_admin()`. The
field only decides what is shown; a database that cannot answer reads as `false`
there. `GET /api/admin/me` is the first route in the list and proves the gate end
to end.

**6. The service-role key is not used for admin reads or writes, with one
exception: the two sync jobs.** It skips RLS (`docs/supabase.md`), so using it
would remove the database check this record depends on. Admin handlers call the
database with the admin's own session token, and RLS plus `is_admin()` decide.

*Amended 2026-11-05 (issue 494).* The home news and game stats syncs read an
outside site and write the content tables, which only the service role may do,
exactly as their Vercel cron routes do. The admin area may run them on demand,
on these conditions, each held by a test:

- The key is opened only inside two named functions, `runHomeNewsJob` and
  `runGameStatsJob` (`src/server/admin/sync-jobs.ts`), and only after the
  database has said yes to *this* administrator and *this* job: `admin_begin_run`
  is called with the admin's own token, checks `is_admin()`, the allow-list and
  the cooldown, and commits an audit row first. No other admin file may name the
  key or open the client that holds it.
- The jobs are chosen from a fixed allow-list of keys, in the database and in
  code. Nothing free-form reaches either sync.
- The key and its client never appear in an answer. The admin area calls the sync
  code directly; it does not call the cron routes, so `CRON_SECRET` and
  `SYNC_SECRET` are neither read, sent nor exposed by it.
- The rebuilds need no key at all: they are database functions called under the
  admin's own token, each of which checks `is_admin()` itself.

**7. Admin pages are not indexed.** Admin routes set `robots: noindex,
nofollow` through a per-route flag (`ROUTE_NOINDEX`) in
`PageMetaTitleStrategy`, and the admin area is rendered in the browser only, so
a server render never describes it. Its link-preview tags are the site's generic
ones with the title "Admin". The browser-side route guard and the hidden Admin
link are cosmetic. Production renders in the browser (`vercel.json`), so the
server refusal and the database check are what protect anything.

## Alternatives considered

- **A role inside the sign-in token (`app_metadata.role = 'admin'`).** RLS would
  read `auth.jwt() -> 'app_metadata' ->> 'role'`, and no table would be needed.
  Rejected: a revoked admin keeps the role until their token refreshes (assumed
  to be about an hour), so "revoke now" is impossible. Granting needs the
  Supabase dashboard or a script holding the service-role key. It is also
  harder to test, because the role lives in a signed token rather than in rows a
  test can insert and delete.
- **An allowlist in an environment variable.** For example `ADMIN_EMAILS`,
  checked in the server code. Rejected: it enforces nothing in the database, so
  admin writes would need the service-role key (decision 6), and matching on
  email is unsafe, because the address from a Discord sign-in is Discord's
  claim and not something this site verified.
- **Amend ADR-0004 instead of adding a record.** Rejected: ADR-0004 covers data
  private to the player who owns it. The operator role is a different subject
  with a different owner, and it should stay readable on its own. This record
  cites ADR-0004 where the two meet.
- **Run a sync by calling its cron route with `CRON_SECRET` (issue 494).**
  Rejected: it has the same power as calling the sync code directly, plus an extra
  network hop, and it puts a secret that can start any sync into a second code
  path. Calling the sync code directly, after the database says yes, keeps that
  secret out of the admin area altogether.
- **Trust the browser guard.** A route guard and a hidden link alone are
  rejected: anyone can call `/api/admin/*` directly (decision 7).

## Consequences

**What this makes easier**

- Later admin pages (#292 and beyond) inherit one gate, one wrapper and one
  header rule instead of re-deciding them.
- Revoking admin is instant: delete the row.
- The check is data, so a test can insert an admin and a non-admin and compare
  what each can do.
- Admin levels later would be a column on `public.admins`, not a rewrite.
- No frozen overlay object changes; this adds tables and functions only.

**What this makes harder, or costs**

- Granting admin is a SQL step run by the owner, not a button. That is the
  point, and it is also a small chore.
- Every admin function must call `is_admin()` itself, because the functions are
  granted to `authenticated`. A missing call cannot be spotted by reading the
  grant list, so it needs a test (Compliance).
- Admin endpoints must exist in two routers (Express and Vercel). They share
  #270's request handling, and the wrapper plus a test over the `api/admin/` files
  keep the two in step.
- A route that forgets `no-store` would be cached for five minutes and could
  show an admin's answer to a stranger. This is the highest risk, and the
  single wrapper exists to make it hard to do.
- Until database tests run in CI (open question 2), the strongest proof that a
  non-admin is refused is a static check plus a manual check against the linked
  project.

**What now has to be true**

- No admin table or function is reachable by `anon`, and none is reachable by
  `authenticated` without an `is_admin()` check.
- No admin route exists outside the wrapper, and none sends a cacheable header.
- The service-role key appears in no admin handler, except that
  `src/server/admin/sync-jobs.ts` opens the client that holds it inside its two
  named functions (decision 6), and nothing in the admin area reads `CRON_SECRET`.
- Every admin action that starts a job writes its audit row, and the row is
  committed before the job begins, so a failure or a timeout cannot erase it.
- Admin pages carry `noindex, nofollow`.
- Any change to who may be admin goes through the owner, by hand.

## Open questions

These are open. This ADR does not decide them. Each is carried to the issue that
owns it.

1. **What #270 delivers** (#290). Answered on 2026-11-04 by reading the code:
   a session cookie, POST and `Origin` handling in
   `src/server/account/account-http.ts` and `account-session.ts`, and a session
   answer, all reused. It does not use a per-request supabase-js client but
   `fetch` with the user's token, which does the same job (see Context).
2. **Database tests in CI.** Answered on 2026-11-04: #270 did not add them, and
   CI starts no database. The chore is filed as #496 (Run real database tests in
   CI). Until it lands, #290 uses the fallback: a static test over every migration
   (`scripts/admin-migrations.test.ts`, run by CI as part of
   `npm run test:functions`) that, from migration `20261104140000` on, holds every
   function a signed-in account can call to `is_admin()` or to an explicit list of
   deliberately open functions, and a check script, `supabase/checks/admins.sql`,
   run against the linked project after the migration is pushed. The Karma tests
   (the browser half) do not run in CI either; that is #497 (Run the Karma tests in
   CI).
3. **Re-authenticating or two-factor sign-in before admin actions** (#292).
   Decided for #290 on 2026-11-04: none, because the area has no actions yet. The
   default for #292 is none in version 1, because the only power it gives is
   choosing a refresh interval from a fixed list. Decide again when an admin page
   can do something destructive. ADR-0004 decision 7 already asks for a recent
   sign-in before account deletion, which is the precedent.
4. **An audit log of admin changes.** None in #290 (it has no changes to log).
   Answered on 2026-11-05 by #494, the first admin action with something to log:
   `public.admin_audit_log` (actor, job, start and end times, outcome and detail;
   the actor is set null, not deleted, when the account goes). Closed to every API
   role, written and read only by the admin functions. Later actions (#292, #495)
   add their own `job` values to it.

## Compliance

A reviewer checks a change against this ADR by looking for:

- Every table and function declared in an admin migration has RLS on (tables),
  execute revoked from `public` and `anon` (functions), and no `authenticated`
  grant on a table. A static test over the admin migrations asserts this, and
  asserts that every function they declare, other than `is_admin()` itself,
  calls `is_admin()` or is callable by no API role (execute revoked from
  `public`, `anon`, `authenticated` and `service_role`, as the internal helpers
  of #494 are; the admin functions that call them run as their owner). With
  database tests in CI (open question 2),
  a test signs in as a non-admin and gets no rows or a permission error from
  every admin table and function.
- Every `/api/admin/*` endpoint answers 401 signed out and 403 for a signed-in
  non-admin, and carries `Cache-Control: private, no-store` on every answer; a
  test covers each endpoint in the admin route list.
- Admin routes are registered only through the wrapper, in both Express and the
  Vercel function.
- No admin handler imports or reads the service-role key, other than the single
  use in `sync-jobs.ts` described in decision 6, which `scripts/admin-routes.test.ts`
  holds to two named functions.
- A test on `PageMetaTitleStrategy` shows admin routes set `noindex, nofollow`.
- No public route gained the admin guard, and the Admin link renders only when
  the session says admin.
- `docs/supabase.md` describes how the owner grants and revokes admin, and one
  grant and revoke has been done by hand on the live project. As of 2026-11-04
  that last step is outstanding: it is the owner's, after the migration is
  deployed.
- No secret value appears in the repo; credentials are named only.
