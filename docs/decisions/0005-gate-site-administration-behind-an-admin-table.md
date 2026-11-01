# ADR-0005: Gate site administration behind an admin table and a database check

- **Status:** Proposed
- **Date:** 2026-11-01
- **Deciders:** Anthony (maintainer). Proposed from the engineering refinement
  of #290 (approach A1) and waiting for his confirmation, which is why the
  status is Proposed.
- **Related:** epic #289; this issue #293; #290 (admin role and gated admin
  area), #291 (spike on `pg_cron`), #292 (refresh schedule page). Builds on
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

- The site has no sign-in yet (`docs/architecture.md`: "None. There is no
  login, JWT, or OAuth"). #270 builds it, and `admin` appears nowhere in code,
  migrations or docs. What #270 will deliver is taken from ADR-0004 decision 9
  and is an assumption until #270 merges: a server-held session cookie, handlers
  mounted once in both Express (`src/server.ts`) and the Vercel function
  (`api/[...path].ts`), Supabase calls made per request with the publishable
  key plus the user's own token (so row-level security, RLS, which are database
  rules about who may read which row, is the real guard), an `Origin` check on
  every POST, and `private, no-store` on every answer.
- Anyone can register, so the `authenticated` database role no longer means
  "trusted" (ADR-0004, Consequences: "Sign-up is open to anyone on a public
  site ... no new grant may assume otherwise"). A check that only asks "is this
  user signed in?" would admit every stranger who registers.
- The API accepts only GET today and answers anything else with 405
  (`api/[...path].ts:37-40`, `src/vercel-api.ts:36-39`). Admin changes need
  POST, which #270 is expected to add.
- Default API answers are cached by the CDN (the shared web cache) for five
  minutes, and a stale copy may be served for up to an hour
  (`api/[...path].ts:29`, `src/vercel-api.ts:5`). A route that forgets to
  override that would hand one visitor's answer to the next. A `no-store`
  variant exists today for a single route (`api/[...path].ts:31-34`).
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
same posture as the other website-only tables (Context). Nothing reads the table
except the check below.

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
  admin's (the wrapper asks `is_admin()` once, using the request's own Supabase
  client from #270);
- sends `Cache-Control: private, no-store` on every answer, including errors and
  refusals;
- is the only way an admin route is registered, in both Express and the Vercel
  function, so a new route cannot be added without it.

Admin POSTs also get #270's `Origin` check.

**6. The service-role key is never used for admin reads or writes.** It skips
RLS (`docs/supabase.md`), so using it would remove the database check this
record depends on. Admin handlers use the per-request client, which runs under
the admin's own session, and RLS plus `is_admin()` decide.

**7. Admin pages are not indexed.** Admin routes set `robots: noindex,
nofollow` through a per-route flag in `PageMetaTitleStrategy`, and give link
previews nothing to describe. The browser-side route guard and the hidden Admin
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
- Admin endpoints must exist in two routers (Express and Vercel). They are
  expected to share #270's handler module; if #270 does not provide one, that
  work moves to #290 and enlarges it.
- A route that forgets `no-store` would be cached for five minutes and could
  show an admin's answer to a stranger. This is the highest risk, and the
  single wrapper exists to make it hard to do.
- Admin work waits on #270 (sign-in, POST handling, a session endpoint).
- Until database tests run in CI (open question 2), the strongest proof that a
  non-admin is refused is a static check plus a manual check against the linked
  project.

**What now has to be true**

- No admin table or function is reachable by `anon`, and none is reachable by
  `authenticated` without an `is_admin()` check.
- No admin route exists outside the wrapper, and none sends a cacheable header.
- The service-role key does not appear in any admin handler.
- Admin pages carry `noindex, nofollow`.
- Any change to who may be admin goes through the owner, by hand.

## Open questions

These are open. This ADR does not decide them. Each is carried to the issue that
owns it.

1. **What #270 delivers** (#290). This record assumes a per-request Supabase
   client, POST and `Origin` handling, a handler module shared by both
   routers, and a session or "me" answer the browser can ask whether the user
   is an admin. If #270 differs (for example, a browser-side Supabase client),
   the server half of #290 changes. Read #270 before writing #290's code.
2. **Database tests in CI** (#270 or its own chore, ahead of #290). The usual
   route is `npx supabase start` plus `npx supabase test db`, which needs the
   installed CLI to support it and the CI runner to have Docker; both are
   assumptions. ADR-0004 already asks for a database test on #270's own tables
   (one user reads nothing of another's), so #270 should own the setup. If it
   does not, file it as a separate chore and block #290 on it.
3. **Re-authenticating or two-factor sign-in before admin actions** (#290,
   #292). The default is none in version 1, because the only power #292 gives is
   choosing a refresh interval from a fixed list. Decide again when an admin page
   can do something destructive. ADR-0004 decision 7 already asks for a recent
   sign-in before account deletion, which is the precedent.
4. **An audit log of admin changes.** The default is none in #290 and a small
   one with #292. This is carried over from the refinement and is not one of the
   three questions on #293.

## Compliance

A reviewer checks a change against this ADR by looking for:

- Every table and function declared in an admin migration has RLS on (tables),
  execute revoked from `public` and `anon` (functions), and no `authenticated`
  grant on a table. A static test over the admin migrations asserts this, and
  asserts that every function they declare, other than `is_admin()` itself,
  calls `is_admin()`. With database tests in CI (open question 2),
  a test signs in as a non-admin and gets no rows or a permission error from
  every admin table and function.
- Every `/api/admin/*` endpoint answers 401 signed out and 403 for a signed-in
  non-admin, and carries `Cache-Control: private, no-store` on every answer; a
  test covers each endpoint in the admin route list.
- Admin routes are registered only through the wrapper, in both Express and the
  Vercel function.
- No admin handler imports or reads the service-role key.
- A test on `PageMetaTitleStrategy` shows admin routes set `noindex, nofollow`.
- No public route gained the admin guard, and the Admin link renders only when
  the session says admin.
- `docs/supabase.md` describes how the owner grants and revokes admin, and one
  grant and revoke has been done by hand on the live project.
- No secret value appears in the repo; credentials are named only.
