# API Specification

GET /api/heroes
GET /api/meta
GET /api/hero-stats
GET /api/community/figures
GET /api/community/kills
GET /api/community/hero-scores
GET /api/hero-matchups
GET /api/hero-pairs
POST /api/coach/analyze
GET /api/auth/session
GET /api/auth/discord/start
GET /api/auth/callback
POST /api/auth/sign-out
POST /api/account/delete
POST /api/account/link
POST /api/account/unlink
GET /api/account/dashboard
GET /api/admin/me
GET /api/admin/data-jobs
POST /api/admin/data-jobs-run

Static reference data for other tools is published separately as Pulse Atlas; see [pulse-atlas.md](pulse-atlas.md).

`/api/hero-stats` serves the hero numbers derived from Rivals Pulse overlay matches, and `/api/hero-matchups` how each hero fares against each enemy hero in those matches (the only source of counter data); see "Reading the hero aggregates" in [supabase.md](supabase.md).

`/api/hero-pairs` serves the counts behind the community counter and partner figures: for one half-season, per band (today only `all`, All Ranks), each hero's `appearances` and `wins`, each directional hero-against-enemy pair (`counters`) and each pair that played together (`synergies`, listed once with the lower `heroId` first), with `matches`, `appearances` and `wins`. Heroes are the game's numeric ids, Deadpool's role forms merged under 1057, in the Quick Match and Competitive blend. It carries counts only, no rate (readers compute those from `priorMatches`), and lists a pair only from `minimumMatches` decided matches. Like `/api/hero-matchups` it shows the previous half-season, naming the current one in `inPlaceOf`, while the current one has no such pair, and it answers 200 with `status: "not-enough-data"` before any exists. Pulse Atlas publishes it as `community-stats`; see [pulse-atlas.md](pulse-atlas.md).

`/api/hero-stats` takes two optional query values: `halfSeason` (an exact half-season such as `10.5`) and `mode` (`quick-match`, `competitive`, `arcade`, `practice` or `all`, the default Quick Match and Competitive blend). Every answer carries `mode` and the `modes` on offer.

`/api/community/stats` serves the Community Stats tab's role benchmarks (average K/D/A, KDA, final hits and win rate per role and mode) from the same matches; see "Role benchmarks" in [supabase.md](supabase.md). It takes the same optional `halfSeason` query value.

The `/api/auth/*` and `/api/account/*` routes belong to the Discord sign-in and the account. They are
never cached: every answer carries `Cache-Control: private, no-store, max-age=0`. `GET /api/auth/session`
answers `{ "signedIn": false }` with no session, or `{ "signedIn": true, "account": { email, provider,
createdAt }, "player": { name, avatarUrl } | null, "isAdmin": boolean }` (`player` is the linked in-game player, null when
none or when the link could not be read; `isAdmin` is what `public.is_admin()` says, false when it could not be read, and
only decides whether the header shows the Admin link), and never returns the account id. `GET /api/auth/discord/start?next=/path` redirects to
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
read the way a person types it (`src/server/account/link-code.ts`: any case, spaces or dashes, `O` as 0, `I` and `L` as
1). It answers 200 `{ "player": { name, avatarUrl } }`; 400 with the one message "That code is wrong or has
expired. Get a new one from the desktop app." for a wrong, used, expired or malformed code (the cases are
never told apart); 429 `{ error, retryAfterSeconds }` after five wrong codes in 15 minutes; 401 with no
valid session; 503 when Supabase is unavailable. `POST /api/account/unlink` takes no body and answers 200
`{ "player": null }`, with the same 401 and 503. Both obey the Origin check and `no-store` of the other
account routes.

`/api/admin/*` is the site administration API (ADR-0005), and every route in it goes through one wrapper
(`handleAdminRequest`, `src/server/admin/admin-api.ts`). It answers 401 with no valid session, 403 for a signed-in
account that is not an administrator (`public.is_admin()`, asked of the database on every request), and 503 when the
database cannot say; a POST also needs the same-site `Origin` the account routes ask for. Both refusals come before the
route is looked up, so on Express a caller who is not an admin gets the same answer for a made-up route (on Vercel an
address with no file under `api/admin/` gets Vercel's own 404). Every answer, refusals
included, carries `Cache-Control: private, no-store, max-age=0`. `GET /api/admin/me` answers 200 `{ "admin": true }` and
exists to prove the gate. The routes are listed in `ADMIN_ROUTES` (`src/server/admin/admin-routes.ts`); to add one, see
there.

`GET /api/admin/data-jobs` answers `{ "jobs": [...] }`: for each of the seven data jobs, `lastScheduled` and `lastManual` (each
`null` or `{ outcome: "succeeded" | "failed" | "running" | "unfinished", startedAt, finishedAt, detail, message }`) and `wait` (`null`, or
`{ reason: "running" | "cooldown", retryAt }`). `POST /api/admin/data-jobs-run` takes `{ "job": "<key>" }` from that fixed list (400 for
anything else) and answers when the job has finished: 200 `{ "run": { job, outcome: "succeeded" | "failed", detail, recorded } }`, where
`detail.result` is `rebuilt`, `news-synced`, `stored`, `stored-with-fallbacks`, `already-captured` or `failed`, and `recorded` is false if
its audit row could not be closed; or 409 `{ error, reason, retryAt }` when the job is running or in its cooldown, in which case it did
not start. The types are in `src/contracts/admin-data-jobs.model.ts`; see "Running the data jobs on demand" in
[supabase.md](supabase.md).

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
- `firstPlayedAt` and `lastPlayedAt`;
- `activity`: `maps`, `modes`, `days`, `weekdays`, `timesOfDay` and `sessionPlaces`, each a list of `{ label, matches, wins, losses, winRate }`, read by the private My matches and My insights tabs. Days and times are UTC.

No line, uid or recorder id is in the answer. It answers 401 with no valid session (clearing the cookie when the
session has ended) and 503 when Supabase is unavailable, without signing the player out; a POST gets 405.

`/api/community/figures` serves damage, healing and damage blocked per minute per role and per hero, and `/api/community/kills` the kill-feed counters (which heroes a hero is seen killing most, and is seen killed by most), from the extended upload. They read through the database functions `read_community_hero_figures` and `read_community_kill_feed`, which return only buckets at least 3 distinct players contributed to with no player above 50%. Rates are whole numbers and kill counts are volume bands. Until those functions exist in the database (issue 457) or enough matches carry the fields, both answer 200 with `status: "not-enough-data"`; any other failure keeps its error status. Both take the optional `halfSeason` query value.

`/api/community/hero-scores` serves each hero's 1 to 10 Damage, Sustain, Ultimate and Utility scores, with the label, the match count and the figures behind them, or how far along a hero below the rule is, from the Quick Match and Competitive blend. It reads through the database function `read_community_hero_scores`. Scores and rules are in [hero-build-scores.md](hero-build-scores.md) and the shape in `src/contracts/hero-scores.model.ts`. Heroes are named by their id in `heroes.json`. Until the function exists it answers 200 with `status: "not-enough-data"`, and so does an answer in which no hero has a score yet; any other failure keeps its error status. It takes the optional `halfSeason` query value. Pulse Atlas publishes it as `hero-scores`; see [pulse-atlas.md](pulse-atlas.md).
