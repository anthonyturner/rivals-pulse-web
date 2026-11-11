# API Specification

GET /api/heroes
GET /api/meta
GET /api/hero-stats
GET /api/community/matches
GET /api/community/insights
GET /api/community/figures
GET /api/community/kills
GET /api/community/hero-scores
GET /api/hero-matchups
GET /api/hero-switch-ins
GET /api/hero-pairs
GET /api/records
GET /api/triple-support-trios
GET /api/team-lineups
GET /api/hero-synergies
POST /api/coach/analyze
GET /api/auth/session
GET /api/auth/discord/start
GET /api/auth/callback
POST /api/auth/sign-out
POST /api/account/delete
POST /api/account/link
POST /api/account/unlink
GET /api/account/records-opt-in
POST /api/account/records-opt-in
POST /api/account/media-defaults
GET /api/account/dashboard
GET /api/admin/me
GET /api/admin/data-jobs
POST /api/admin/data-jobs-run
POST /api/slack/events

`POST /api/slack/events` is the Slack Events API endpoint that lets Tony answer a Needs Tony item from Slack (not a site route; Slack calls it). Every request must carry a Slack signature (`X-Slack-Signature` and `X-Slack-Request-Timestamp`, made with `SLACK_SIGNING_SECRET`, at most five minutes old) over the exact body; otherwise it answers 401, and 503 while the setting is missing. It echoes a signed `url_verification` challenge. A signed `message` event posts a comment on a GitHub issue only when it is a plain thread reply from `SLACK_TONY_USER_ID` in `SLACK_NEEDS_TONY_CHANNEL_ID` under a message that links an open `needs-tony` issue; the answer is `{ "outcome": "posted" | "duplicate" | "ignored" | "unanswerable" }`, never his text, and 502 when GitHub or Slack failed (Slack then delivers it again; a retry never posts twice). Never cached. See [agent-workflows/tony-answers.md](agent-workflows/tony-answers.md).

Static reference data for other tools is published separately as Pulse Atlas; see [pulse-atlas.md](pulse-atlas.md).

`/api/hero-stats` serves the hero numbers derived from Rivals Pulse overlay matches, and `/api/hero-matchups` how each hero fares against each enemy hero in those matches (the only source of counter data); see "Reading the hero aggregates" in [supabase.md](supabase.md). `/api/hero-matchups` gives each matchup a `kda` and a `finalHitsAverage`: the hero's KDA, and its final hits per scoreboard line, across its lines while facing that enemy hero. Both are null where the lines did not record them, and for every half-season counted before the figures were stored; they are sums divided once, never an average of averages. `/api/hero-stats` also states `minimumPlayers` (2) and gives each `belowMinimum` hero the `players` counted so far (the different players who recorded the hero in the mode asked for, and in the Quick Match and Competitive blend each person counted once whichever of the two they played; where only the per-mode counts exist, the largest of them; absent where the database never counted it). `minimumPlayers` is enforced: a hero is placed (in `tiers`) only once it has `minimumMatches` appearances and at least `minimumPlayers` players, and below either it stays in `belowMinimum` with its `appearances` and `players`. A hero with no `players` (the database never counted it, as in every half-season frozen before the count) is placed on `minimumMatches` alone.

`/api/hero-switch-ins` serves how often a team won after a player switched heroes, in Quick Match and Competitive, for one half-season. Each `switchIns` entry names the hero switched to (`hero`) and the `enemy` hero that was on the field at that moment, as ids in `heroes.json` with Deadpool's role forms merged, with `matches` and `switches` (a switch faced with two enemy heroes counts once for each; both count only teams with a result), `wins`, a `winRate` (a percentage over those switches) and `overall`, the hero's own record against that enemy over every match (`matches`, `appearances`, `wins`, `winRate`), or null where that matchup has too few matches. An entry appears only once the pairing has `minimumMatches` (10) matches from `minimumPlayers` (2) different players in the half-season and mode; the list is sorted by hero, then enemy, which is not a ranking. Like `/api/hero-matchups` it takes no query values, shows the previous half-season, naming the current one in `inPlaceOf`, while the current one has none, and answers 200 with `status: "not-enough-data"` before any exists. It carries counts only, no player and no recorder count. See "Hero switch-in aggregates" in [supabase.md](supabase.md).

`/api/hero-pairs` serves the counts behind the community counter and partner figures: for one half-season, per band (today only `all`, All Ranks), each hero's `appearances` and `wins`, each directional hero-against-enemy pair (`counters`) and each pair that played together (`synergies`, listed once with the lower `heroId` first), with `matches`, `appearances` and `wins`. Heroes are the game's numeric ids, Deadpool's role forms merged under 1057, in the Quick Match and Competitive blend unless a `mode` is asked for. It takes the optional `halfSeason` and `mode` query values described below, and carries `halfSeasons`, `mode` and `modes` like `/api/hero-stats`. It carries counts only, no rate (readers compute those, with `priorMatches` as the prior for a pair), and lists a pair only from `minimumMatches` decided matches. Like `/api/hero-matchups` it shows the previous half-season, naming the current one in `inPlaceOf`, while the current one has no such pair, and it answers 200 with `status: "not-enough-data"` before any exists. Pulse Atlas publishes it as `community-stats`; see [pulse-atlas.md](pulse-atlas.md).

`/api/game-stats` serves the game-level counts for the Stats overview, from Rivals Pulse overlay uploads only: `matches` and `players` (the different players seen on their scoreboards), `since` (when the earliest counted match was played, or null) and `halfSeasons`, newest first, each with its `halfSeason`, `matches` and `players`. It carries counts only and covers the matches the app still holds, up to about six months. Before the first upload, or while its migration is not applied, it answers zeros, an empty list and a null `since`; see "Website game stats" in [supabase.md](supabase.md).

`/api/triple-support-trios` serves the teams that ran exactly three Strategists in Quick Match and Competitive (or one `mode`), for one half-season: `trios`, each with `heroIds` (the three game hero ids ascending, Deadpool's role forms under 1057), `heroes` (the same three as ids in `heroes.json`), a `variant` (`label`, such as "Adam Warlock + Mantis triple" or "Three healers", and the `anchorHeroIds` it names), `matches` (matches with a result), `teams` (team occurrences; a match where both teams ran the trio counts twice), `wins` (of those occurrences) and `share` (`teams` over `classifiedTeams`, 0 to 1), most played first, plus the half-season's `classifiedTeams` (teams whose heroes all have a known role), `unclassifiedTeams` (teams with a hero no role is known for, never counted as a trio) and `fourPlusTeams` ("Quad support" teams, counted as that shape only, with no trio). A trio is listed from `minimumMatches` matches; like `/api/hero-pairs` it shows the previous half-season, naming the current one in `inPlaceOf`, while the current one has none, and answers 200 with `status: "not-enough-data"` before any exists. A trio with a Strategist that has no tag, or a utility hero with no name, is left out and logged. It takes the same `halfSeason` and `mode` query values as `/api/hero-pairs` and carries `halfSeasons`, `mode` and `modes`. It carries counts only: a win rate is `wins / teams`. How a trio is named is in [pulse-atlas.md](pulse-atlas.md#the-strategist-tags-data).

`/api/team-lineups` serves the team line-ups in Competitive matches (or one `mode`), for one half-season: `shapes`, each a Vanguard-Duelist-Strategist count of one team at the end of a match (`shape`, such as "1-2-3", with `vanguards`, `duelists` and `strategists`), `status`, `teams` (team occurrences; a mirror match counts both teams, a match uploaded twice once), `wins` (of those), `pickRate` (`teams` over `classifiedTeams`, 0 to 1) and `winRate` (`wins` over `teams`, 0 to 1), most played first, plus the half-season's `classifiedTeams` (teams whose heroes all have a known role) and `unclassifiedTeams` (teams with a hero no role is known for: no hero recorded, an unknown id, Deadpool's role-less base form; never counted in a shape). A shape under `minimumTeams` (50) teams is listed with `status: "not-enough-data"` and its `teams` so far, with null `wins`, `pickRate` and `winRate`; the database withholds those figures. Like `/api/hero-pairs` it shows the previous half-season, naming the current one in `inPlaceOf`, while the current one has no shape at the minimum, and answers 200 with `status: "not-enough-data"` before any exists. It takes the same `halfSeason` and `mode` query values as `/api/hero-pairs` with the same rules, except that a request with no `mode` counts Competitive, not the Quick Match and Competitive blend (`mode=all` asks for the blend), and it carries `halfSeasons`, `mode` and `modes` like `/api/hero-stats`. It names no player and no hero. Pulse Atlas publishes it as `team-lineups`, counts only; see [pulse-atlas.md](pulse-atlas.md).

`/api/hero-synergies` serves the pairs of `/api/hero-pairs` that played together, named for pages: for the same half-season (with the same `inPlaceOf` fallback) and mode as `/api/hero-pairs`, taking the same `halfSeason` and `mode` query values, each `synergies` entry has the two heroes' ids in `heroes.json` (`hero` and `ally`), `matches`, `appearances`, `wins`, a `winRate` and a `shrunkWinRate` (both percentages), listed once per pair from `minimumMatches` decided matches and sorted by hero, then ally, which is not a ranking. Unlike `/api/hero-pairs`, which merges Deadpool's role forms under his base id 1057 (the shape the Pulse Atlas publishes), it counts each form apart: Deadpool is listed once per form played, with `heroRole` or `allyRole` set to `Vanguard`, `Duelist` or `Strategist` (the roles of 10571, 10572 and 10573), so a page can file the pair under the role that was played. His base id 1057 is listed with no role, and a hero is never paired with another form of itself. Each form needs the minimum on its own. The roles are absent for every other hero. It answers 200 with `status: "not-enough-data"` while no pair has reached the minimum. The Stats Team comps tab (`/stats/team-comps`) reads it, `/api/triple-support-trios` and `/api/team-lineups`, opening on `mode=competitive`.

`/api/hero-stats` takes two optional query values: `halfSeason` (an exact half-season such as `10.5`) and `mode` (`quick-match`, `competitive`, `arcade`, `practice` or `all`, the default Quick Match and Competitive blend). Every answer carries `mode` and the `modes` on offer. `/api/hero-pairs`, `/api/hero-synergies`, `/api/triple-support-trios` and `/api/team-lineups` take the same two query values with the same rules: a `halfSeason` that has not started or that nothing knows, or a `mode` that names no mode, answers 200 with `status: "not-enough-data"` (a `mode` that names none has `mode: null`) instead of falling back to the current half-season or the blend, and `halfSeason` asks for exactly that half-season, with no `inPlaceOf` fallback. Their answers also carry `halfSeasons` (every half-season that has started, oldest first) and `modes` with each mode's decided matches in the half-season shown; both are absent from an answer a CDN cached before they existed.

`/api/community/matches` serves the Community matches section of the Stats overview: win rate by map, the mix of game modes with their average length, and each day's share of the matches, from the anonymous community aggregates (see "Community match aggregates" in [supabase.md](supabase.md)). It takes the same optional `halfSeason` query value. It carries no count of a map, mode or day: percentages and minutes, plus one exact total, `matchesCounted`, the site's one "matches counted" figure for the half-season shown (the same number `/api/game-stats` lists for that half-season, read from `read_game_counts()` so a thin map, mode or day cannot change it; null when no half-season is shown, the counts no longer hold it, or they cannot be read). A map under its minimum is named but never counted. `minimums` states the rule (it is not a count). Before any bucket passes the rule, or before the aggregates exist, it answers 200 with `status: "not-enough-data"`; any other failure keeps its error status.

`/api/community/insights` serves when the community plays and wins (weekday, time of day in UTC, place in a play session): only whole-percentage shares and win rates of the buckets the database lets through, with no counts. Before any bucket passes, or before the aggregates exist, it answers 200 with `status: "not-enough-data"`; any other failure keeps its error status. See "Play-time aggregates" in [supabase.md](supabase.md).

Neither route reads a session or an account. Your own matches and insights are in the `activity` of `GET /api/account/dashboard`, below.

`/api/community/stats` serves the Stats Roles tab's role benchmarks (average K/D/A, KDA, final hits and win rate per role and mode) from the same matches; see "Role benchmarks" in [supabase.md](supabase.md). It takes the same optional `halfSeason` query value.

The `/api/auth/*` and `/api/account/*` routes belong to the Discord sign-in and the account. They are
never cached: every answer carries `Cache-Control: private, no-store, max-age=0`. `GET /api/auth/session`
answers `{ "signedIn": false }` with no session, or `{ "signedIn": true, "account": { email, provider,
createdAt }, "player": { name, avatarUrl } | null, "isAdmin": boolean, "mediaDefaults": { heroVideo, sound } | null }` (`player` is the linked in-game player, null when
none or when the link could not be read; `isAdmin` is what `public.is_admin()` says, false when it could not be read, and
only decides whether the header shows the Admin link; `mediaDefaults` is the account's hero video and sound defaults, both false when it
has chosen none, and null when they could not be read, which pages treat as a signed-out visitor), and never returns the account id. `GET /api/auth/discord/start?next=/path` redirects to
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

`GET /api/account/records-opt-in` answers the signed-in account's "Show me in Pulse Records" setting as `{ "showInRecords": boolean }`
(false until the account switches it on), read with the account's own token so only its own row can come back.
`POST /api/account/records-opt-in` takes `{ "show": true | false }` and the `rp_session` cookie and answers 200
`{ "showInRecords": boolean }` with the value the database saved. Anything but a real boolean is 400 `{ error: "Choose on or off." }`;
turning it on without a linked player is 409 with a plain reason; 401 with no valid session; 503 when Supabase is unavailable (a
failed read is never reported as off). Nothing in the body names an account: the database acts on the session's account alone.
The setting goes back to off whenever the account's link is removed or replaced. The POST obeys the Origin check, and both
answers are `no-store`, like the other account routes. See "The Show me in Pulse Records switch" in [supabase.md](supabase.md).

`POST /api/account/media-defaults` takes `{ "heroVideo"?: boolean, "sound"?: boolean }` and the `rp_session` cookie, saves the defaults it
names and leaves the other as it was, and answers 200 `{ "heroVideo": boolean, "sound": boolean }` with both values as the database stored them.
A body that names neither, or names one that is not a real boolean, is 400 `{ error: "Choose on or off." }`; 401 with no valid session; 503 when
Supabase is unavailable. Nothing in the body names an account: the database acts on the session's account alone. The POST obeys the Origin
check, and the answer is `no-store`, like the other account routes. See "The media defaults" in [supabase.md](supabase.md).

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
- `activity`: `maps`, `modes`, `days`, `weekdays`, `timesOfDay` and `sessionPlaces`, each a list of `{ label, matches, wins, losses, winRate }`, shown as My matches and My insights on the `/profile` page. Days and times are UTC.

No line, uid or recorder id is in the answer. It answers 401 with no valid session (clearing the cookie when the
session has ended) and 503 when Supabase is unavailable, without signing the player out; a POST gets 405.

`/api/community/figures` serves damage, healing and damage blocked per minute per role and per hero, and `/api/community/kills` the kill-feed counters (which heroes a hero is seen killing most, and is seen killed by most), from the extended upload. They read through the database functions `read_community_hero_figures` and `read_community_kill_feed`, which return only buckets at least 2 distinct players contributed to (`community_max_recorder_share_percent()` is 100, so no one player is capped). Rates are whole numbers and kill counts are volume bands. Until those functions exist in the database (issue 457) or enough matches carry the fields, both answer 200 with `status: "not-enough-data"`; any other failure keeps its error status. Both take the optional `halfSeason` query value.

`/api/community/hero-scores` serves each hero's 1 to 10 Damage, Sustain, Ultimate and Utility scores, with the label, the match count and the figures behind them, or how far along a hero below the rule is, from the Quick Match and Competitive blend. It reads through the database function `read_community_hero_scores`. Scores and rules are in [hero-build-scores.md](hero-build-scores.md) and the shape in `src/contracts/hero-scores.model.ts`. Heroes are named by their id in `heroes.json`. Until the function exists it answers 200 with `status: "not-enough-data"`, and so does an answer in which no hero has a score yet; any other failure keeps its error status. It takes the optional `halfSeason` query value. Pulse Atlas publishes it as `hero-scores`; see [pulse-atlas.md](pulse-atlas.md).

`/api/records` serves the Pulse Records boards as `{ status, coveredFrom, categories: [{ key, title, rows: [{ heroId, hero, value, name }] }] }`: kills, assists, final hits, damage, healing and damage blocked, up to 50 rows each, best first. `heroId` is the game's numeric hero id and `hero` the hero's id in `heroes.json`, or null for a game id the roster lacks. `name` is the link's player name for a player who switched naming on, otherwise null (anonymous). `coveredFrom` is the UTC day of the oldest line the boards can draw on. A row carries no uid, recorder, line id or match time. It answers `status: "not-enough-data"` with six empty boards before any line qualifies or before the database function is applied; any other failure keeps its error status. It is cached for 60 seconds at most with no stale window, so a name is gone within two minutes of its owner switching naming off. A board holds one row per uploader, so its row count is also its number of distinct uploaders; the Stats Records tab (`/stats/records`) shows a board only from 2 rows. See "Pulse Records read" in [supabase.md](supabase.md).
