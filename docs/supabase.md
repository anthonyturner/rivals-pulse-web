# Supabase

This repo owns the Supabase project that the Rivals Pulse overlay (the Overwolf
in-game app, repo `rivals_pulse`) uploads match data to. The source lives in
[`supabase/`](../supabase): `config.toml`, the migrations, the Edge Functions
(small Deno programs Supabase hosts) and `functions/_shared`. It was copied
byte for byte from the overlay repo; the overlay repo's own copy is removed in a
follow-up there.

There is **one** live project. Nothing in CI deploys it: every change is a
manual `supabase` CLI run (the CLI is the `supabase` dev dependency, run with
`npx supabase`). No project reference or secret value appears in the repo; the
CLI keeps the link in `supabase/.temp/`, which git ignores along with
`supabase/.branches/`.

## Frozen for shipped overlays

Players run overlays that call these objects with a publishable key baked into
the app. Renaming or altering any of them breaks players without failing this
repo's build. This is a move, not a redesign.

- Edge Functions: `track-match-history`, `elevenlabs-agent-token`,
  `sync-match-history`, `sync-hero-stats`. All keep `verify_jwt = false`
  (the publishable key is not a JWT, so the platform check would reject every
  call; each function authorises callers itself).
- Tables: `players`, `player_matches`, `matches`, `tracked_matches`,
  `match_history_sync_state`, `player_hero_profiles`, `player_hero_stats`,
  `hero_stats_sync_state`, `jarvis_token_requests`, `participants`.
- Functions in the database: `claim_upload_slot`, `record_match_participants`,
  `purge_expired_participants`.
- Row Level Security (RLS) stays strict on every table, because the key ships
  in the overlay.

## Migrations

| File | Adds |
| --- | --- |
| `20260731000000_match_history.sql` | Provider match history tables |
| `20260731010000_hero_stats.sql` | Provider hero stats tables |
| `20260815000000_tracked_match_history.sql` | `tracked_matches` (a recorder's own matches) |
| `20260819001043_hero_videos.sql` | `heroes` and `hero_videos`, readable by anyone; recovered from the live project's migration history |
| `20260819002052_add_gefest_role_guides.sql` | Allows the `gefest-role-guide` video type; recovered the same way |
| `20260924000000_jarvis_token_rate_limit.sql` | `jarvis_token_requests` |
| `20261009000000_participants.sql` | `participants`, `do_not_store`, `half_seasons`, `participant_upload_log` and the functions that write to them |
| `20261010000000_participants_fill_late_result.sql` | `record_match_participants` fills a blank `is_win` on a repeat upload |
| `20261027000000_participants_final_hits.sql` | `participants.final_hits` (each player's Final Hits, null when not counted); `record_match_participants` writes it and fills a blank one on a repeat upload |
| `20261029000000_participants_mode_map.sql` | `participants.play_mode_id` and `participants.map_name` (null when the game did not say); `record_match_participants` takes them as two trailing arguments and fills a blank one on a repeat upload |
| `20261030000000_hero_aggregates.sql` | Anonymous hero counts that outlive the purge: `hero_aggregates`, `hero_aggregate_totals`, `hero_matchups`, `hero_aggregate_half_seasons` and the functions that rebuild them; `purge_expired_participants` freezes a half-season before it deletes from it; an hourly `recompute-hero-aggregates` job |
| `20261030042403_hero_content.sql` | `hero_content`, `hero_list_items`, `hero_abilities`, `sync_runs`, `external_sources` and the `save_hero` function (the website's hero data, moved from Turso) |
| `20261030042500_hero_content_data.sql` | The one-off copy of the Turso hero rows into those tables |
| `20261030050000_hero_stats_read.sql` | `read_hero_stats()` and `read_hero_matchups(smallint[])`: the only way the publishable key reads the hero aggregates (security definer, counts only, granted to `anon`) |
| `20261030060309_home_content.sql` | `home_portals` and `home_content_blocks` (the website's home page content, moved from Turso) |
| `20261030060507_home_content_data.sql` | The one-off copy of the Turso home rows, and the home news sync's `external_sources` snapshot, into those tables |
| `20261030140000_play_time_aggregates.sql` | Anonymous play-time counts for the Community Insights tab: `play_time_aggregates`, `play_time_aggregate_half_seasons`, the functions that rebuild and freeze them, `read_community_insights()` (service role only) and an hourly `recompute-play-time-aggregates` job |

Link once per machine, check history, then apply:

```sh
npx supabase link --project-ref <project-ref>
npx supabase migration list --linked      # local and remote columns must match
npx supabase db push                       # only once the list is understood
```

Never run `db reset --linked`, `migration repair --status reverted` or a
reseed against the live project. Use `migration repair --status applied
<version>` only for a version whose objects verifiably already exist.
`supabase db diff --linked` needs Docker; where Docker is missing, compare with
`migration list` and read-only `npx supabase db query --linked "<sql>"` checks.

## Changing a database function's signature

`record_match_participants` grew two trailing arguments (`p_play_mode_id`,
`p_map_name`, both defaulting to null) while the deployed call, which passes
five named arguments, stayed compatible. A signature change is always `drop
function` plus `create function` in one migration, followed by a restated
`revoke` and `grant execute ... to service_role`, because Postgres grants
EXECUTE to everyone on a new function. Never `create or replace` with extra
arguments: it adds a second overload beside the old one, PostgREST cannot
choose between them (PGRST203), and every upload fails. After the push,
`select count(*) from pg_proc where proname = 'record_match_participants'` must
return 1.

## Website hero data

The website's heroes live in `hero_content` (one row per hero; `raw_json` is the record
`/api/heroes` returns), `hero_list_items` and `hero_abilities`. They sit beside `heroes`,
which only feeds `hero_videos` and is left alone: its two rows for Deadpool and Jeff the Land
Shark differ from the website's. Row-level security is on with no policy, so only the server's
secret key can read or write them.

- Every writer calls the `save_hero(p_hero jsonb)` function through `saveHero` in
  [`src/hero-store.ts`](../src/hero-store.ts). It stores the hero and rebuilds its list items
  and abilities from the same JSON in one transaction. Do not write the tables directly.
- Syncs record each run in `sync_runs` (a `details` column holds what changed) and keep their
  last fetched payload in `external_sources`; see [`src/sync-log.ts`](../src/sync-log.ts).
  Both tables are shared by the other web content domains as they move.
- The scripts and the `Sync new heroes` workflow need `SUPABASE_URL` and
  `SUPABASE_SERVICE_ROLE_KEY` (repository secrets for the workflow).
- `20261030042500_hero_content_data.sql` was generated from Turso by
  `scripts/export-turso-heroes.mjs`. It skips rows that already exist, so running it twice never
  overwrites newer data. Before pushing it, `node scripts/export-turso-heroes.mjs --check
  <file>` must say Turso still matches it; if not, regenerate it with `--out`. Issue 110 deletes
  the script with Turso.
- `jsonb` does not keep the order of an object's keys, so `/api/heroes` returns the same data
  with keys in a different order.

## Website home content

The home page reads `home_portals` (one row per portal card; `raw_json` is the card
`/api/home/portals` returns, and the unique `sort_order` is the display order) and
`home_content_blocks` (one row per key of `/api/home/content`, such as `latestNews`; `payload` is
null for an empty block). Row-level security is on with no policy, so only the server's secret key
reads or writes them. [`src/home-content-store.ts`](../src/home-content-store.ts) is the only code
that touches them.

- The daily Vercel cron `/api/sync/home-news` (`src/home-news-sync.ts`) rewrites the blocks it owns
  in one request, records each run in `sync_runs` under `home-news`, and keeps its official-site
  snapshot in `external_sources` under `official-marvel-rivals-home`. Vercel needs
  `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- `npm run db:seed` loads the portals and the blocks named in `data/seeds/home-content.mock.json`
  through `scripts/seed-home-content.mjs`. It never removes a block the seed file does not name.
- `20261030060507_home_content_data.sql` was generated from Turso by
  `scripts/export-turso-home-content.mjs`. The cron rewrites Turso every day at 03:00 UTC until the
  merge, so run `node scripts/export-turso-home-content.mjs --check <file>` right before the push and
  regenerate with `--out` if it fails.
- `scripts/verify-home-content-cutover.mjs` checks the move: `capture` saves the live endpoints to
  `data/cutover/home-endpoints.json`, no argument compares Supabase with Turso and the capture, `live`
  compares the deployed endpoints with the capture, and `sync-run` looks for a successful run. Issue
  110 deletes it, the export script and the capture with Turso.

## Edge Functions

| Function | Deployed |
| --- | --- |
| `track-match-history` | yes |
| `elevenlabs-agent-token` | yes |
| `sync-match-history` | yes, but not used by the release overlay |
| `sync-hero-stats` | yes, but not used by the release overlay |
| `marvel-rivals-proxy` | yes, but its source is not in this repo yet (it lives on the overlay branch `fix/381-api-key-server-side`) |

The live deployments can be older than the source here. Check
`npx supabase functions list` before assuming they match.

```sh
npx supabase functions deploy track-match-history
npx supabase functions deploy elevenlabs-agent-token
```

`track-match-history` keeps each recorder's newest 5,000 `tracked_matches` rows
(`MAX_TRACKED_MATCHES_PER_PLAYER` in `tracked-match-retention.ts`). The
participants backfill replays those rows, so lower the cap only after it has
run.

## Secrets

Set with `npx supabase secrets set NAME=value`. Names only here.

| Secret | Used by | Note |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | all | Supplied by Supabase itself |
| `OVERWOLF_EXTENSION_ID` | `track-match-history`, `elevenlabs-agent-token` | The overlay's Overwolf extension id (the long id in its `overwolf-extension://<id>/` window URLs). A packed store build and an unpacked dev build differ. |
| `RECORDER_ID_SECRET` | `track-match-history` | Random 32+ bytes (`openssl rand -hex 32`). Keys the hash that replaces the Overwolf username. Changing it resets everyone's rate-limit history and nothing else. |
| `ELEVENLABS_MAIN_API_KEY`, `ELEVENLABS_AGENT_ID` | `elevenlabs-agent-token` | See that function's header |
| `TEBEX_STORE_PUBLIC_TOKEN` | `elevenlabs-agent-token` | The Tebex store's public token. The premium gate switch, which also needs `OVERWOLF_EXTENSION_ID` on this function: unset or empty and the function mints tokens for anyone; set and every caller needs a verified Overwolf session and a paid plan (401, 403 `premium-required`, 503 when Overwolf is down). |
| `HERO_STATS_SYNC_COOLDOWN_SECONDS`, `MATCH_HISTORY_SYNC_COOLDOWN_SECONDS` | `sync-hero-stats`, `sync-match-history` | Optional. Seconds before the same player can be synced again. |
| `PREMIUM_JARVIS_PACKAGE_IDS` | `elevenlabs-agent-token` | Optional comma-separated Tebex package ids that count as premium. Unset means any package of the store; set to something with no valid id, the gate refuses everyone (500). |

Deploy order for `track-match-history`: migration, then secrets, then
function. A function deployed first fails closed (every upload is refused).

## Premium launch order

Premium is dormant until configured, on both sides. The order matters:

1. Deploy `elevenlabs-agent-token` with `TEBEX_STORE_PUBLIC_TOKEN` still unset.
   Nothing changes for anyone.
2. Release the overlay with the store's public token, package-to-perk map and
   package to sell set. The overlay now gates Jarvis and sends the Overwolf
   session; the function still accepts everyone.
3. Set `TEBEX_STORE_PUBLIC_TOKEN` last. Setting it before step 2 stops Jarvis
   for every player. Set `PREMIUM_JARVIS_PACKAGE_IDS` with it if only some
   packages should count.

## Hero aggregates

`participants` rows are deleted once the half-season after their own has ended, so the counts the
site needs are kept separately, as anonymous numbers with no uid, name or fingerprint
(`hero_aggregates` per half-season, mode and hero; `hero_aggregate_totals` per half-season and mode;
`hero_matchups` per hero against an enemy hero). All four tables have RLS on and no policy, so only
the service role reaches them.

- `recompute_hero_aggregates()` rebuilds every half-season that still has raw rows and is not
  frozen, from scratch, so running it twice changes nothing and a late result or a `forget_player`
  shows up on the next run. The hourly `recompute-hero-aggregates` pg_cron job runs it.
- `purge_expired_participants()` rebuilds and freezes each half-season it is about to delete from,
  before deleting. A frozen half-season is never rebuilt, so its counts keep the contribution of
  anyone forgotten after the freeze. Frozen means `frozen_at` is set in `hero_aggregate_half_seasons`.
- A match is its roster fingerprint plus its start time. `play_mode_id` -1 means the game did not say.
- A matchup is stored, in each mode it was seen in, only when its decided matches summed over all
  modes of the half-season reach `hero_matchup_min_matches()`. The per-hero minimum (10, the tier
  rule) belongs to the code that derives tiers.
- A row that arrives in a half-season after the purge froze it is never counted, so a backfill must
  finish before the half-season it fills comes due.
- A rebuild failing inside the purge would stop deletion, which is why the hourly job exercises the
  same code long before any half-season is due.

## Backfilling participants from stored matches

`npm run backfill:participants` replays the rows of `tracked_matches` through
`parseParticipants`, `rosterFingerprint` and `record_match_participants` (issue 143), so the
counting rules keep one owner. It reaches the linked project through `npx supabase db query
--linked` and reads no service key. The default is a dry run that writes nothing and prints, per
half-season, the matches, new against repeat, lines without a result and the agreement with the
lines already stored. `-- --apply` replays for real, one transaction per half-season.

- A stored row keeps its roster only when an older app uploaded it. A newer row (the upload
  boundary of ADR-0011) keeps just the recorder's own line, so it is matched to the stored match
  that player was in, and replayed under that fingerprint as a repeat: it fills the blank mode, map
  and result and inserts nothing. When the player has two stored matches inside the window it takes
  the nearest in time, and skips the row if two different matches are equally near. The roster
  lookup takes the nearest stored match too.
- The recorder's team and win or loss are rebuilt from `performance`; the time is
  `match_time_stamp`, not the upload-age rule of the live path.
- A row with no season takes the latest `half_seasons` row that had started by its time. For a match
  older than every row, pass `--before-first-half-season=<n>`; `--apply` refuses a match with that
  label that was played before 2026-07-10, when Season 9 began.
- An error is reported by exit status, error code and SQLSTATE only, never the text, because it can
  quote the statement and so a player's name or uid.
- Rows of an already frozen half-season are skipped, so a second run inserts nothing. A replayed row
  of an ended half-season is counted by the aggregates, then frozen and deleted by the next purge.
- Replayed rows carry the recorder marker `backfill-143`; the original hash is not stored.

## Reading the hero aggregates (web app)

The website reads the aggregates through two functions, granted to `anon` and `service_role` and
to nobody else. Both run as their owner and return one jsonb value (so PostgREST's 1000-row page
limit never applies), made only of counts and `half_seasons` start dates:

- `read_hero_stats()` returns `half_seasons`, `totals` and `heroes`. The server calls it over
  PostgREST with plain `fetch` and the publishable key ([`src/hero-stats-read.ts`](../src/hero-stats-read.ts)).
  Vercel needs `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; the service-role key is not used for this.
- `read_hero_matchups(p_play_mode_ids)` returns hero against enemy hero, summed over the chosen modes
  (default Competitive and Quick Match). `hero_matchups` keeps a matchup only when its decided
  matches over all modes reach `hero_matchup_min_matches()`, so the function applies the minimum
  again to the chosen modes' own sum. Nothing calls it yet; the counter picks work will.

Every rate, tier and KDA is derived in one pure module, [`src/hero-stats.ts`](../src/hero-stats.ts),
and served by `GET /api/hero-stats`. The rules, which are the overlay's personal tier list:

- A hero is placed once it has 10 appearances in matches with a win or a loss. Its tier comes from
  the shrunk win rate `(wins + 5) / (matches + 10)`: S from .62, A .56, B .52, C .48, D .44, else F.
- A hero's "appearances" are its scoreboard lines (a hero on both teams of one match counts twice,
  as in the overlay); the pick rate is those lines over the matches counted.
- Competitive and Quick Match (`play_mode_id` 0 and 1) are blended. Unknown (-1), Arcade and Practice
  are left out.
- KDA is (kills + assists) over deaths, from totals, with no deaths treated as 1.
- `GET /api/hero-stats?halfSeason=<number>` answers for exactly that half-season (10 or 10.5), with no
  fall back to the previous one; a half-season that has not started, or a value that is not a number,
  gets the empty state. Every answer lists the started half-seasons in `halfSeasons`. Pulse Atlas
  reads these to build its community tier list.
- While the current half-season has no hero at the minimum, the previous half-season is returned
  with `inPlaceOf` naming the current one.
- The site picks the current half-season from `half_seasons`, so a new half-season must have its row (see "Each half-season" below) before its first match; without it the site keeps showing the previous half-season.
- A game hero id with no mapping in `data/pulse-atlas/hero-game-ids.json` (hero id 0 is "no hero
  recorded") is left out of the numbers and logged. Deadpool's base id and role variants count as
  one hero.

## Play-time aggregates (Community Insights tab)

`play_time_aggregates` keeps, per half-season, the matches and decided wins of the recorders' own
matches by weekday (`weekday`, ISO 1 Monday to 7 Sunday), by four-hour block of the day
(`time_of_day`, 0 is 00:00 to 03:59) and by place in a play session (`session_position`, 1 to 3 and
4 for the fourth and later), with `recorders`, the number of different players behind the bucket. It
holds no player id, uid, name or per-match row. RLS is on with no policy, and only the service role
reaches it.

- Source: `tracked_matches` (a recorder's own matches, with their own result), not `participants`,
  which does not say which scoreboard line is the recorder's. A match two recorders both played
  counts once for each. A player in `do_not_store` is left out.
- Every day and hour is UTC: the upload carries no offset. A match is placed by its start (end time
  minus duration). Only Quick Match and Competitive count.
- A session ends after `play_session_gap()` (30 minutes) idle between one of a recorder's matches and
  the next. The recorder's id is used inside the aggregation only and never stored.
- `recompute_play_time_aggregates()` rebuilds every half-season that is not frozen, from scratch, on the
  hourly `recompute-play-time-aggregates` job, and freezes a half-season once the next one began and
  `play_time_freeze_grace()` (8 days, past the 7-day upload window) has passed. It does not touch
  `purge_expired_participants`.
- `read_community_insights()` (granted to `service_role` only) returns the buckets and the session gap
  as one jsonb value. The server calls it with the shared client and derives the tab in
  [`src/community-insights.ts`](../src/community-insights.ts), served by `GET /api/community/insights`.
  A bucket is shown from 30 matches and 3 recorders; the site answers "not enough data yet", never an
  error, while the function or tables are missing.

## Each half-season

Retention deletes a scoreboard row once the half-season after its own has
ended. It needs to know when each half-season started. Add a row on the day a
new one begins, from the tier-list site:

```sql
insert into public.half_seasons (half_season, starts_at)
values (11.0, '2026-11-13T09:00:00Z')
on conflict (half_season) do nothing;
```

If a row is missed, rows are still deleted six months after the match (the
policy's hard limit), but later than promised.

## After setup

- **Required:** `select jobname from cron.job where jobname in
  ('purge-expired-participants', 'recompute-hero-aggregates',
  'recompute-play-time-aggregates');` must show all three jobs (the daily purge and the two hourly
  aggregate rebuilds). If one is missing (the migrations warn when `pg_cron` is
  unavailable), enable `pg_cron` and schedule `select public.purge_expired_participants();` daily and
  `select public.recompute_hero_aggregates();` and `select public.recompute_play_time_aggregates();`
  hourly by hand.
- Refused-call checks (no secret needed; `$SUPABASE_URL` is the project URL):

```sh
curl -i -X POST "$SUPABASE_URL/functions/v1/track-match-history" \
  -H "Content-Type: application/json" --data '{}'
# expect 401 "An Overwolf session token is required"

curl -i -X POST "$SUPABASE_URL/functions/v1/track-match-history" \
  -H "Content-Type: application/json" -H "x-overwolf-session: not.a.jwt" --data '{}'
# expect 401 "The Overwolf session token is invalid or expired"
```

- With a real token (from a signed-in overlay, valid 15 minutes), one upload
  returns `{"status":"ok","recorded":1,"participants":N}` and a repeat of the
  same match returns `participants: 0`.
- Deleting a player who asked: `select public.forget_player('<uid>', '<in-game
  name>');` deletes their rows and stops any later upload from storing them
  again. Either argument may be null.

## Server-side client (web app)

Server code reaches Supabase through one shared client in
[`src/supabase-client.ts`](../src/supabase-client.ts). Reuse it; do not create
another. `getSupabaseClient()` builds it from the environment on first use, and
`createSupabaseClient(env)` takes an env record, for tests and scripts.

| Variable | Note |
| --- | --- |
| `SUPABASE_URL` | The project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | A secret key (`sb_secret_...`), not the publishable key. It bypasses RLS, so it stays server-only. |

A missing variable throws an error that names it (never its value).
`GET /api/content/status` reports `supabase: { configured, reachable }` from a
head-only count of `players`. `npm run check:browser-bundle`, run in CI after
the build, fails if `SUPABASE_SERVICE_ROLE_KEY`, `sb_secret_` or
`@supabase/supabase-js` reaches the browser build.

PostgREST (the REST layer the client calls) returns at most 1000 rows per
request, so bulk reads must page with `.range()`. Use a Postgres function
called through `.rpc()` when several writes must succeed or fail together.

## Tests

`npm run test:functions` runs the function tests with Node's built-in test
runner (Node 24, which strips TypeScript types itself). The `ci.yml`
job `Supabase function tests` runs it on every pull request.
