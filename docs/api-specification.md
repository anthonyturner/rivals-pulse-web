# API Specification

GET /api/heroes
GET /api/heroes/{id}
GET /api/meta
GET /api/hero-stats
GET /api/community/insights
GET /api/hero-matchups
POST /api/coach/analyze
GET /api/auth/session
GET /api/auth/discord/start
GET /api/auth/callback
POST /api/auth/sign-out

Static reference data for other tools is published separately as Pulse Atlas; see [pulse-atlas.md](pulse-atlas.md).

`/api/hero-stats` serves the hero numbers derived from Rivals Pulse overlay matches, and `/api/hero-matchups` how each hero fares against each enemy hero in those matches (the only source of counter data); see "Reading the hero aggregates" in [supabase.md](supabase.md).

`/api/community/insights` serves when the community plays and wins (weekday, time of day in UTC, place in a play session), before the aggregates exist it answers 200 with `status: "not-enough-data"`; any other failure keeps its error status. See "Play-time aggregates" in [supabase.md](supabase.md).
`/api/hero-stats` takes two optional query values: `halfSeason` (an exact half-season such as `10.5`) and `mode` (`quick-match`, `competitive`, `arcade`, `practice` or `all`, the default Quick Match and Competitive blend). Every answer carries `mode` and the `modes` on offer.

`/api/community/stats` serves the Community Stats tab's role benchmarks (average K/D/A, KDA, final hits and win rate per role and mode) from the same matches; see "Role benchmarks" in [supabase.md](supabase.md). It takes the same optional `halfSeason` query value.

The `/api/auth/*` routes (and the reserved `/api/account/*`) belong to the Discord sign-in. They are
never cached: every answer carries `Cache-Control: private, no-store, max-age=0`. `GET /api/auth/session`
answers `{ "signedIn": false }` with no session, or `{ "signedIn": true, "account": { email, provider,
createdAt } }`, and never returns the account id. `GET /api/auth/discord/start?next=/path` redirects to
Discord through Supabase (`rivalspulse.com` and `localhost` only; `next` must be a path on this site)
and `GET /api/auth/callback` finishes it, sets the `rp_session` cookie and redirects to `next`, or to
`/sign-in?error=cancelled|failed`. `POST /api/auth/sign-out` ends the session and clears the cookie. A
POST whose `Origin` is missing or not this site's gets 403. Unreachable Supabase answers 503.

