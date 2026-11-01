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
POST /api/account/delete
POST /api/account/link
POST /api/account/unlink
GET /api/account/dashboard

Static reference data for other tools is published separately as Pulse Atlas; see [pulse-atlas.md](pulse-atlas.md).

`/api/hero-stats` serves the hero numbers derived from Rivals Pulse overlay matches, and `/api/hero-matchups` how each hero fares against each enemy hero in those matches (the only source of counter data); see "Reading the hero aggregates" in [supabase.md](supabase.md).

`/api/community/insights` serves when the community plays and wins (weekday, time of day in UTC, place in a play session), before the aggregates exist it answers 200 with `status: "not-enough-data"`; any other failure keeps its error status. See "Play-time aggregates" in [supabase.md](supabase.md).
`/api/hero-stats` takes two optional query values: `halfSeason` (an exact half-season such as `10.5`) and `mode` (`quick-match`, `competitive`, `arcade`, `practice` or `all`, the default Quick Match and Competitive blend). Every answer carries `mode` and the `modes` on offer.

`/api/community/stats` serves the Community Stats tab's role benchmarks (average K/D/A, KDA, final hits and win rate per role and mode) from the same matches; see "Role benchmarks" in [supabase.md](supabase.md). It takes the same optional `halfSeason` query value.

The `/api/auth/*` and `/api/account/*` routes belong to the Discord sign-in and the account. They are
never cached: every answer carries `Cache-Control: private, no-store, max-age=0`. `GET /api/auth/session`
answers `{ "signedIn": false }` with no session, or `{ "signedIn": true, "account": { email, provider,
createdAt }, "player": { name, avatarUrl } | null }` (`player` is the linked in-game player, null when
none or when the link could not be read), and never returns the account id. `GET /api/auth/discord/start?next=/path` redirects to
Discord through Supabase (`rivalspulse.com` and `localhost` only; `next` must be a path on this site)
and `GET /api/auth/callback` finishes it, sets the `rp_session` cookie and redirects to `next`, or to
`/sign-in?error=cancelled|failed`. `POST /api/auth/sign-out` ends the session and clears the cookie. A
POST whose `Origin` is missing or not this site's gets 403. Unreachable Supabase answers 503.

`POST /api/account/delete` takes the JSON body `{ "mode": "account", "confirmation": "delete my account" }`
and the `rp_session` cookie. It answers 401 with no valid session, 401 with `"reason": "recent-sign-in-required"` when the Discord sign-in recorded in the session cookie is more than ten minutes old (the page then sends the player to `/sign-in?next=/account`), 400 when the phrase or mode is wrong
(nothing is deleted), 409 for the mode `account-and-matches` ("Remove account and forget me", not
available until the desktop app is linked), 503 when Supabase or the service-role key is unavailable, and
otherwise 200 `{ "deleted": true }` with the `rp_session` cookie cleared. The auth user is deleted for
good, its `profiles` row with it.

`POST /api/account/link` takes the JSON body `{ "code": "ABCD-EFGH" }` and the `rp_session` cookie and
links the signed-in account to the player the desktop app issued the code for (ADR-0004; the code comes
from the Edge Function `issue-link-code`, see "Website accounts" in [supabase.md](supabase.md)). A code is
read the way a person types it (`src/link-code.ts`: any case, spaces or dashes, `O` as 0, `I` and `L` as
1). It answers 200 `{ "player": { name, avatarUrl } }`; 400 with the one message "That code is wrong or has
expired. Get a new one from the desktop app." for a wrong, used, expired or malformed code (the cases are
never told apart); 429 `{ error, retryAfterSeconds }` after five wrong codes in 15 minutes; 401 with no
valid session; 503 when Supabase is unavailable. `POST /api/account/unlink` takes no body and answers 200
`{ "player": null }`, with the same 401 and 503. Both obey the Origin check and `no-store` of the other
account routes.

`GET /api/account/dashboard` takes the `rp_session` cookie and answers the signed-in player's own stats,
derived on the server from the lines the database can prove are theirs (the recorder and uid of their link;
see "Reading a linked player's own dashboard" in [supabase.md](supabase.md)). It answers 200 `{ "linked":
false }` for an account with no link, otherwise `{ "linked": true, "player": { name, avatarUrl }, "truncated",
"stats" }`. `truncated` is true when more lines existed than the 2,000 read. A figure that was not recorded is
`null`, never 0. `stats` (the type is `OwnDashboardStats` in `src/app/core/auth/own-dashboard.types.ts`):

- `matches`, `wins`, `losses`, `unknownResults` and `winRate` (0 to 1 over known results, null with none);
- `kda`: `{ matches, kills, deaths, assists, killsPerMatch, deathsPerMatch, assistsPerMatch, ratio }` over the
  matches that recorded all three, or null;
- `finalHits`: `{ matches, total, perMatch }` over the matches that counted them, or null;
- `topHeroes`: up to five `{ hero, matches, wins, losses, winRate, kda }`, most played first, `hero` being the id in
  `heroes.json` (a hero the site cannot name is left out);
- `perMinute`: `damage`, `healing` and `blocked`, each `{ perMinute, samples }` or null;
- `records`: `mostKills`, `mostAssists` and `mostFinalHits` as `{ value, playedAt, hero }` or null, and
  `longestWinStreak` (a match with no result ends a streak);
- `recent`: the newest ten `{ playedAt, hero, result: "win" | "loss" | null, kills, deaths, assists, finalHits,
  playModeId, mapName }`;
- `firstPlayedAt` and `lastPlayedAt`.

No line, uid or recorder id is in the answer. It answers 401 with no valid session (clearing the cookie when the
session has ended) and 503 when Supabase is unavailable, without signing the player out; a POST gets 405.
