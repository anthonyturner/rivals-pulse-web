# ADR-0004: Keep all web data in Supabase

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Anthony Turner (maintainer)
- **Related:** [#100](https://github.com/anthonyturner/rivals-pulse-web/issues/100) (parent),
  [#105](https://github.com/anthonyturner/rivals-pulse-web/issues/105),
  [#106](https://github.com/anthonyturner/rivals-pulse-web/issues/106),
  [#107](https://github.com/anthonyturner/rivals-pulse-web/issues/107),
  [#108](https://github.com/anthonyturner/rivals-pulse-web/issues/108),
  [#109](https://github.com/anthonyturner/rivals-pulse-web/issues/109),
  [#110](https://github.com/anthonyturner/rivals-pulse-web/issues/110)

## Context

The website used to read its content (heroes, home page, glossary, hero videos, cached outside
sources, sync history, the tier list and game stats) from Turso, a hosted SQLite-compatible
(libSQL) database, through `@tursodatabase/serverless`. The Rivals Pulse overlay uploads its match
data to a separate database, Supabase (hosted Postgres), which this repository also owns. Two
databases meant two sets of credentials, two schema tools and two places to document, and every
feature that joined content with match data had to cross between them.

Issues 105, 106, 107 and 109 moved each content domain, with every reader and writer, to Supabase
in one pull request per domain. Issue 108 (the tier list) was not migrated: the community tier list
in issue 112 replaced it, and nothing reads or writes the old tier list tables any more. Issue 110
removed the Turso client, its dependency, its environment variables and the one-off copy and check
scripts.

A final export of all 14 Turso tables (schema, row counts and checksums) was taken on 2026-10-31
and is kept outside the repository. The Turso database itself is deleted by a person, because that
cannot be undone.

## Decision

We will keep all of the website's data in the one Supabase project this repository owns. Server
code reaches it only through [`src/supabase-client.ts`](../../src/supabase-client.ts) (scripts
through `scripts/supabase-client.mjs`), and every schema change is a migration under
[`supabase/migrations/`](../../supabase/migrations).

## Alternatives considered

- **Keep Turso for content and Supabase for match data.** Rejected: it kept two databases to run,
  secure and document, and features such as the home page hero stats need both content and match
  aggregates.
- **Move the match data to Turso instead.** Rejected: shipped overlays upload to Supabase objects
  whose names and keys are frozen, so moving them would break players who never update.
- **Migrate the old tier list tables too.** Rejected: nothing reads them; the community tier list
  replaced them, and their rows survive in the final export.

## Consequences

- **Easier:** one set of credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`), one schema
  history, and content can be combined with match aggregates in the database.
- **Harder:** web content now shares a project, and its quotas and outages, with the overlay's
  uploads. Postgres differs from SQLite in places (for example `jsonb` does not keep key order, and
  the glossary needs a generated sort key for case-insensitive order).
- **What now has to be true:** no second database is added for web data without an ADR superseding
  this one. Every web table has row-level security on, and only the server's secret key writes it.

## Compliance

`git grep -i turso` matches only changelog history, this ADR and the applied migrations under
`supabase/migrations/`. `package.json` has no `@tursodatabase/*` or `@libsql/*` dependency. A
reviewer rejects a new database client, or a table created outside `supabase/migrations/`.
