# Supabase

This repo owns the Supabase project that the Rivals Pulse overlay (the Overwolf
in-game app, repo `rivals_pulse`) uploads match data to. The source lives in
[`supabase/`](../supabase): `config.toml`, the migrations, the Edge Functions
(small Deno programs Supabase hosts) and `functions/_shared`. It was copied
byte for byte from the overlay repo; the overlay repo's own copy is removed in a
follow-up there.

There is **one** live project. No GitHub Actions workflow deploys it, but the Supabase GitHub
integration is set to deploy to production when a pull request merges to `master`: it applies the
migrations and deploys the Edge Functions. So a migration that has never run must be applied by
hand (`npx supabase db push`) from the branch and checked **before** its pull request merges. The
rest of this file's commands are manual `supabase` CLI runs (the CLI is the `supabase` dev
dependency, run with `npx supabase`). No project reference or secret value appears in the repo; the
CLI keeps the link in `supabase/.temp/`, which git ignores along with
`supabase/.branches/`.

The integration refuses to run if production has a migration that `master` does not. The `Supabase
Preview` check then fails with `Remote migration versions not found in local migrations directory.`,
and that merge deploys no functions. This happened from 2026-11-01 to 2026-11-04, because a migration
pushed from a branch stayed unmerged. So merge a pull request soon after pushing its migration.

If the check fails on `master` with that message, land the missing migration file. The next merge that
passes then deploys every function change merged during the outage, all at once, so make sure any
migration or secret they need is in place first. Deploy a function by hand only if it cannot wait for
that.

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
  `hero_stats_sync_state`, `participants`.
- Functions in the database: `claim_upload_slot`, `record_match_participants`,
  `purge_expired_participants`, `record_match_extras` (called by the deployed `track-match-history`
  once it carries the extended upload, so renaming it or changing its arguments silently drops
  every newer overlay's extras; a signature change follows "Changing a database function's
  signature" below), `record_match_ability_uses` and `record_match_hero_timelines` (the same).
- Tables the deployed functions write: `participant_hero_figures` and `match_hero_kills` (written by
  `record_match_extras`), `participant_hero_ability_uses` (written by `record_match_ability_uses`), `match_hero_timelines` (written by `record_match_hero_timelines`), `tracked_match_recorders` (written by `track-match-history` itself) and
  `voice_ai_token_requests` (written by `elevenlabs-agent-token`; the publishable key cannot reach it). The
  aggregate tables are read by the website only.
- The body that `track-match-history` accepts. Newer overlays add optional fields to it (see
  "Extended upload" below); a body without them is stored exactly as before, and a field added later
  must be optional in the same way.
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
| `20261030060939_reference_content.sql` | `glossary_terms` (the website's glossary, moved from Turso) |
| `20261030061259_reference_content_data.sql` | The one-off copy of the Turso glossary terms and the four `external_sources` rows the hero and home slices did not copy |
| `20261030120000_extended_upload.sql` | `participant_hero_figures` (the recorder's damage, healing, blocked and seconds per hero, tied to their `participants` line), `match_hero_kills` (a match's kill feed by hero) and `record_match_extras`, the new function that writes them |
| `20261030120100_extended_aggregates.sql` | Anonymous counts of those: `hero_figure_aggregates`, `hero_kill_aggregates`, `hero_kill_totals`, `extended_aggregate_half_seasons` and the functions that rebuild and freeze them; `purge_expired_participants` freezes them before it deletes; an hourly `recompute-extended-aggregates` job |
| `20261031011746_game_stats.sql` | `game_stat_snapshots`, `game_stat_snapshot_games` and the `record_game_stat_snapshot` function (the website's game stats, moved from Turso); dropped by `20261109160000` |
| `20261031015025_game_stats_data.sql` | The one-off copy of the Turso game stat history into those tables; dropped with them by `20261109160000` |
| `20261031020000_community_match_aggregates.sql` | Anonymous match counts for the Community Matches tab: `community_map_aggregates`, `community_mode_aggregates`, `community_day_aggregates`, `community_match_half_seasons`, the functions that rebuild and freeze them, `read_community_matches()` (service role only) and an hourly `recompute-community-match-aggregates` job |
| `20261031020100_play_time_aggregates.sql` | Anonymous play-time counts for the Community Insights tab: `play_time_aggregates`, `play_time_aggregate_half_seasons`, the functions that rebuild and freeze them, `read_community_insights()` (service role only) and an hourly `recompute-play-time-aggregates` job |
| `20261031060000_extended_aggregates_gate.sql` | The first recorder gate on the extended aggregates, from PR 235; recovered from the live project's migration history, where it was already applied. `20261104120000` replaces its functions |
| `20261101010000_profiles.sql` | `profiles`, one row per website account (RLS: the owner selects and inserts) |
| `20261101020000_player_links.sql` | Linking an account to an in-game player: `player_links` (the owner selects), `link_codes` and `link_attempt_log` (service role and the functions only), and `link_code_hash`, `issue_link_code`, `redeem_link_code`, `unlink_player` |
| `20261101030000_tracked_match_recorders.sql` | `tracked_match_recorders` (which verified recorder uploaded each `tracked_matches` row; service role only, deleted with the match) |
| `20261101040000_refresh_linked_player.sql` | The app refreshing its link's name and avatar: `refresh_linked_player` and the shared per-recorder limiter `take_link_app_call` (service role only), a `refresh` kind in `link_attempt_log`, and a `purge_link_data` that ages out every kind of the app's own calls |
| `20261101050000_app_link_status.sql` | The app reading and removing its own link: `link_status_for_recorder` and `unlink_player_for_recorder` (service role only), and the `status` and `unlink` kinds in `link_attempt_log` |
| `20261101060000_dashboard_read.sql` | `read_own_dashboard()`: a linked account's own `participants` lines and hero figures (newest 2,000), granted to `authenticated` only |
| `20261101070000_hero_pair_aggregates.sql` | Anonymous hero pair counts, against (`vs`) and together (`with`): `hero_pair_aggregates`, `hero_pair_totals`, `hero_pair_aggregate_half_seasons`, the functions that rebuild and freeze them, `read_hero_pairs(smallint[])` (granted to `anon`) and an hourly `recompute-hero-pair-aggregates` job; `purge_expired_participants` freezes them before it deletes |
| `20261107120000_triple_support_trios.sql` | Anonymous triple-support trio counts: `hero_game_roles` (the role of each game hero id), `triple_support_trios`, `triple_support_totals`, `triple_support_aggregate_half_seasons`, the functions that rebuild and freeze them, `read_triple_support_trios(smallint[])` (granted to `anon`), an hourly `recompute-triple-support-aggregates` job, and a `purge_expired_participants` that also freezes them |
| `20261107140000_team_lineup_shapes.sql` | Anonymous team line-up counts, written by the triple-support rebuild: `team_lineup_shapes`, `team_lineup_min_teams()` (50), `read_team_lineup_shapes(smallint[])` (granted to `anon`), and restated `fill_triple_support_aggregates` and `rebuild_triple_support_aggregates` that also write and empty the shapes. No new job, freeze or purge: the existing ones cover it |
| `20261101090000_cron_run_history_cleanup.sql` | A daily `purge-cron-run-history` pg_cron job that deletes `cron.job_run_details` rows whose run ended (or started, if it never ended) more than seven days ago (pg_cron keeps every run forever otherwise); creates no table or function |
| `20261103120000_voice_ai_token_requests.sql` | Renames `jarvis_token_requests` to `voice_ai_token_requests`, with its key, index and sequence, so the name does not depend on the assistant's name |
| `20261104120000_hero_figure_contributors.sql` | How many players contributed to each hero figure and kill pair, in numbers only; the rule `hero_figure_qualifies`; `read_community_hero_figures` and `read_community_kill_feed`; `participant_hero_ability_uses`, `hero_ability_aggregates` and `record_match_ability_uses`. Drops all-zero segments and figures with no time played from the aggregates |
| `20261104130000_hero_score_read.sql` | `read_community_hero_scores()` (service role only): what the 1 to 10 hero build scores are worked out from, including how far along a hero below the rule is |
| `20261104140000_admins.sql` | `admins` (the site administrators, no grant to the API roles) and `is_admin()` (granted to `authenticated` only): the database half of the admin area |
| `20261104150000_admin_data_jobs.sql` | Running the data jobs on demand: `admin_audit_log` (closed to every API role), `sync_runs.by_admin`, the helpers `data_job_cooldown`, `data_job_unfinished_after` and `data_job_wait` (callable by no API role, so neither security definer nor guarded), and `admin_begin_run`, `admin_run_rebuild`, `admin_finish_run` and `admin_data_jobs_status` (granted to `authenticated` only, each asking `is_admin()` first) |
| `20261105120000_community_tabs_ten_matches.sql` | The Community Matches and Insights tabs show a figure at 10 matches from any number of players: `insights_min_matches` 10, `insights_min_recorders` 1, `insights_max_recorder_share_percent` 100, and `community_tab_bucket_shown`, which `read_community_matches` now uses. `community_bucket_shown` is unchanged |
| `20261107100000_account_settings.sql` | `account_settings` (`show_in_records`, off by default; the owner selects, no client writes) |
| `20261107100100_pulse_records_read.sql` | `records_hidden` (closed to every API role), the ceiling helpers `pulse_records_value_cap` and `pulse_records_rate_cap`, and `read_pulse_records()` (service role only) |
| `20261107130000_records_opt_in.sql` | The "Show me in Pulse Records" switch: `set_records_opt_in(boolean)` (granted to `authenticated` only) and a trigger on `player_links` that switches the setting off whenever a link row is deleted |
| `20261109120000_media_defaults.sql` | `account_settings.hero_video_default` and `sound_default` (off by default) and `set_media_defaults(boolean, boolean)` (granted to `authenticated` only): a signed-in account's defaults for the hero page gameplay video and for sound (issue 705) |
| `20261108120000_two_player_community_minimum.sql` | Restates `hero_figure_qualifies` and `community_bucket_shown` with a player minimum of 2 instead of 3, and a limit on the busiest player read from the new `community_max_recorder_share_percent()` (100, so no cap; it was 50) (issue 603). The 10-match minimum is unchanged |
| `20261108140000_team_lineup_thin_shape_counts.sql` | `read_team_lineup_shapes` returns a shape's `teams` while it is under `team_lineup_min_teams()`; its `wins` and `enough_data` are still withheld (issue 616). Same signature, gate and grants |
| `20261108150000_hero_score_busiest_share.sql` | `read_community_hero_scores` flags the busiest player as `top * 100 > n * community_max_recorder_share_percent()` instead of a fixed half, so the flags are false at a 100% limit (issue 616). Same signature, security and grants |
| `20261108160000_hero_aggregate_recorders.sql` | `hero_aggregates.recorders`, the different recorders behind each hero per half-season and mode (null where never counted, such as a half-season frozen earlier); `fill_hero_aggregates` fills it and `read_hero_stats` returns it. The database only counts; the website gates on it (issues 628, 640). Same signatures and grants |
| `20261108170000_hero_blended_recorders.sql` | `hero_aggregates.blended_recorders`, the different recorders behind each hero across Quick Match and Competitive together, each person once; the same value on the hero's Quick Match and Competitive rows, null on any other mode and where never counted (a frozen half-season). `fill_hero_aggregates` fills it and `read_hero_stats` returns it, and the blended view of hero stats and the tier list gates on it (issue 644). Same signatures and grants |
| `20261108180000_match_hero_timelines.sql` | `match_hero_timelines` (each player's hero picks with the second they happened, by team, no uid or name, once per match), `record_match_hero_timelines`, the helper `json_whole_number`, and `purge_expired_participants` restated to delete timelines on the schedule of `match_hero_kills`, with every freeze still called |
| `20261108190000_hero_switch_in_aggregates.sql` | `hero_switch_ins` and its half-season table (how often a team won after a player switched to a hero while an enemy hero was on the field, per half-season and mode, counts only), its fill, rebuild, recompute (hourly) and freeze, `read_hero_switch_ins` (gated by `hero_figure_qualifies`), and `purge_expired_participants` restated to call the new freeze before its first delete |
| `20261108200000_hero_timeline_recorder.sql` | `match_hero_timelines.recorded_by` (nullable, the keyed recorder hash, closed to `anon` and `authenticated` like the rest of the table), `record_match_hero_timelines` replaced by a four argument version whose `p_recorded_by` defaults to null, and `fill_hero_switch_in_aggregates` restated to count players from the timeline uploader. The purge is not touched |
| `20261108210000_hero_matchup_encounter_figures.sql` | `hero_matchups` also stores the kills, deaths, assists and final hits (a sum and a count each) of a matchup's decided lines, null for a half-season frozen before it; `fill_hero_aggregates` and `read_hero_matchups` return them |
| `20261108220000_hero_switch_in_hero_forms.sql` | `fill_hero_switch_in_aggregates` restated to read every hero id as its base id from `hero_game_roles`, so Deadpool's role forms are one hero (1057): a change of form is no switch, and a match is counted once however many forms it switches to (issue 667). Same signature, grants and everything else |
| `20261109000000_verified_match_history_reads.sql` | `read_own_tracked_matches` and `read_player_scoreboard_lines` (service role only, keyed on the verified recorder, rate limited as `history` and `scoreboard`), the `link_attempt_log` kinds for them, and an index on `tracked_match_recorders (recorded_by, recorded_at desc)`. Additive: the `anon` select on `players`, `player_matches` and `tracked_matches` stays until shipped overlays use the new reads (issue 189) |
| `20261109100000_backfill_tracked_match_recorders.sql` | `backfill_tracked_match_recorders()` (service role only, adds `tracked_match_recorders` rows only) and one call of it: ties matches uploaded before the recorder table to the single recorder of their player, so `read_own_tracked_matches` returns them (issue 697) |
| `20261109140000_game_counts.sql` | `read_game_counts()` (service role only, read-only): the matches and different players in `participants`, in total and per half-season, for the Game Stats page (issue 381). Additive: no table is touched. Check with `supabase/checks/game_counts.sql` |
| `20261109160000_drop_steam_game_stat_snapshots.sql` | Drops `game_stat_snapshots`, `game_stat_snapshot_games` and `record_game_stat_snapshot`, deletes the `sync_runs` rows for the `game-stats` key, and restates `data_job_cooldown()` and `admin_data_jobs_status()` without `game-stats` (issue 743) |

Build signals temporarily use their own 10-match, one-player rule in `20261106170000_solo_hero_build_signals.sql`. Only `read_community_hero_scores` changes; no rebuild is needed. Check with `supabase/checks/solo_hero_build_signals.sql` after applying. Restore the original reader through a new migration when solo testing ends.

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
  [`src/server/heroes/catalog/hero-store.ts`](../src/server/heroes/catalog/hero-store.ts). It stores the hero and rebuilds its list items
  and abilities from the same JSON in one transaction. Do not write the tables directly.
- Syncs record each run in `sync_runs` (a `details` column holds what changed) and keep their
  last fetched payload in `external_sources`; see [`src/server/sync/sync-log.ts`](../src/server/sync/sync-log.ts).
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
reads or writes them. [`src/server/content/home/home-content-store.ts`](../src/server/content/home/home-content-store.ts) is the only code
that touches them.

- The daily Vercel cron `/api/sync/home-news` (`src/server/content/home/home-news-sync.ts`) rewrites the blocks it owns
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

## Website reference content

The glossary, the hero videos and the cached outside sources moved from Turso in issue 106.

- `glossary_terms` holds one row per term; `raw_json` is the record `/api/glossary` returns.
  `term_sort_key` is generated from `term` and gives the order SQLite's `COLLATE NOCASE` gave.
  RLS is on with no policy. [`src/server/content/glossary-store.ts`](../src/server/content/glossary-store.ts) reads and writes it;
  `npm run sync:glossary` (all terms), `sync:glossary:missing` and `sync:glossary:terms -- <id>`
  copy from `data/seeds/glossary.mock.json`. The production build runs `sync:glossary:missing`,
  so the Vercel build environment needs `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
- The website reads `hero_videos` (from `20260819001043_hero_videos.sql`, which already held the
  same videos) through [`src/server/heroes/catalog/hero-video-store.ts`](../src/server/heroes/catalog/hero-video-store.ts), and only the PAZ
  types: the table's Gefest role guides are still hard-coded on the heroes page.
  `npm run sync:hero-videos` makes the table match `data/seeds/hero-videos.mock.json`. A video's
  hero must exist in `public.heroes` (the foreign key), not only in `hero_content`.
  Unlike `glossary_terms`, `hero_videos` is still readable with the publishable key: the August
  migration gave `anon` and `authenticated` a select grant and a read policy, and they also hold
  usage and select on `hero_videos_id_seq`. Removing them means altering an existing table, which
  the create-only migration rule rules out for this slice, so the lockdown is part of issue 157.
- `/api/external-sources/:key` reads `external_sources` through
  [`src/server/sync/sync-log.ts`](../src/server/sync/sync-log.ts); `npm run db:sync` refreshes the Fandom sources.
- Each of these syncs records a `sync_runs` row (`glossary`, `hero-videos`, one per Fandom source).
- `20261030061259_reference_content_data.sql` was generated by
  `scripts/export-turso-reference.mjs`, the same way as the hero data. Before pushing it,
  `node scripts/export-turso-reference.mjs --check <file>` must pass; after the push,
  `node scripts/verify-reference-content.mjs` compares Supabase with Turso and with the endpoint
  JSON captured before the cutover (`data/turso-cutover/106`), and checks that `anon` and
  `authenticated` hold no privilege on `glossary_terms`. Once each writer has run,
  `node scripts/verify-reference-content.mjs sync-run` checks that its latest `sync_runs` row
  succeeded. Issue 110 deletes both scripts and the captures with Turso.

## Website game stats

The Stats overview (`/stats`, formerly the Game Stats page) counts the matches and players the RivalsPulse app has seen in overlay uploads, and
nothing from outside the app (issue 381). Steam, SteamDB, Wikipedia and NetEase figures are gone.

- `GET /api/game-stats` calls `public.read_game_counts()` through
  [`src/server/game-counts/game-counts-read.ts`](../src/server/game-counts/game-counts-read.ts) with the service-role client. The
  function is `security definer`, granted to the service role only, and returns counts only: `matches`, `players`, `since` (the
  earliest match played) and `half_seasons`, newest first, each with its own `matches` and `players`. No uid, name, fingerprint or
  recorder leaves it.
- It counts the raw `participants` rows, so it covers the matches still held under the retention rule (the half-season after a
  match's own has ended, or six months), for matches and for players alike. A match is its roster fingerprint plus its start time,
  as in `fill_hero_aggregates`, so the match count agrees with the hero numbers. A player is the in-game uid, or the lower-cased
  trimmed name where the game sent no uid. A player is counted once in the total and once per half-season they appear in.
- While the migration is not applied the endpoint answers zero matches and the page shows "No matches counted yet". Any other
  failure is a 500 and the page says the counts could not be loaded. The CDN keeps an answer for five minutes.
- `supabase/checks/game_counts.sql` proves the totals against the raw rows. Run it after `supabase db push`:
  `npx supabase db query --linked -f supabase/checks/game_counts.sql`.
- The Steam snapshots are gone. `20261109160000_drop_steam_game_stat_snapshots.sql` (issue 743) drops `game_stat_snapshots`,
  `game_stat_snapshot_games` (their migrations are `20261031011746_game_stats.sql` and `20261031015025_game_stats_data.sql`)
  and `record_game_stat_snapshot`, with about 2,400 hourly captures; only a Supabase backup brings them back. Tony agreed to
  that on 2026-11-09. The same migration deletes the `sync_runs` rows with `source_key = 'game-stats'`, since no job has that
  key any more, and restates `data_job_cooldown()` and `admin_data_jobs_status()` without `game-stats`. The `admin_audit_log`
  rows for that key stay, because the audit log is kept for good. The hourly Vercel cron, `npm run sync:game-stats`, the Turso
  copy and verification scripts and the admin "Game stats" data job were removed with Steam.

## Edge Functions

| Function | Deployed |
| --- | --- |
| `track-match-history` | yes |
| `elevenlabs-agent-token` | yes |
| `sync-match-history` | yes, but not used by the release overlay |
| `sync-hero-stats` | yes, but not used by the release overlay |
| `marvel-rivals-proxy` | yes, but its source is not in this repo yet (it lives on the overlay branch `fix/381-api-key-server-side`) |
| `issue-link-code` | yes, needs the secrets below |
| `refresh-linked-player` | yes, needs the secrets below |
| `link-status`, `unlink-player-app` | yes, need the secrets below |
| `read-match-history`, `read-player-scoreboard` | not yet; deploy with the secrets below (issue 189) |

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

Each upload also writes a `tracked_match_recorders` row (`tracked_match_id`, `recorded_by`) naming the
verified recorder, so a linked player's history can later be counted past the six-month
`participants` window. It is a side table because `tracked_matches` is publicly readable: **never add
`recorded_by` to `tracked_matches`**, since it is the hash that identifies a linked person. The table
has RLS on and no grant to `anon` or `authenticated`; deleting a tracked match, which is how the cap
above prunes, deletes its row. Rows exist only from the day the function carrying this write is
deployed. The write is logged, never fatal, if it fails, so the upload's request and reply are
unchanged. `supabase/checks/tracked_match_recorders.sql` proves the rules against the linked
project and rolls back: `npx supabase db query --linked -f supabase/checks/tracked_match_recorders.sql`.

## Secrets

Set with `npx supabase secrets set NAME=value`. Names only here.

| Secret | Used by | Note |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | all | Supplied by Supabase itself |
| `OVERWOLF_EXTENSION_ID` | `track-match-history`, `elevenlabs-agent-token`, `issue-link-code`, `refresh-linked-player`, `link-status`, `unlink-player-app`, `read-match-history`, `read-player-scoreboard` | The overlay's Overwolf extension id (the long id in its `overwolf-extension://<id>/` window URLs). A packed store build and an unpacked dev build differ. |
| `RECORDER_ID_SECRET` | `track-match-history`, `issue-link-code`, `refresh-linked-player`, `link-status`, `unlink-player-app`, `read-match-history`, `read-player-scoreboard` | Random 32+ bytes (`openssl rand -hex 32`). Keys the hash that replaces the Overwolf username. **Rotating it breaks every account link**: `player_links.recorder_id` holds the old hash, so no new code (made with the new key) can match it, and every linked player has to link again; it also resets everyone's rate-limit history and detaches the `recorded_by` already stored on matches. Do not rotate it without a plan for both. |
| `ELEVENLABS_MAIN_API_KEY`, `ELEVENLABS_AGENT_ID` | `elevenlabs-agent-token` | See that function's header |
| `TEBEX_STORE_PUBLIC_TOKEN` | `elevenlabs-agent-token` | The Tebex store's public token. The premium gate switch, which also needs `OVERWOLF_EXTENSION_ID` on this function: unset or empty and the function mints tokens for anyone; set and every caller needs a verified Overwolf session and a paid plan (401, 403 `premium-required`, 503 when Overwolf is down). |
| `HERO_STATS_SYNC_COOLDOWN_SECONDS`, `MATCH_HISTORY_SYNC_COOLDOWN_SECONDS` | `sync-hero-stats`, `sync-match-history` | Optional. Seconds before the same player can be synced again. |
| `PREMIUM_PULSA_PACKAGE_IDS` | `elevenlabs-agent-token` | Optional comma-separated Tebex package ids that count as premium. Unset means any package of the store; set to something with no valid id, the gate refuses everyone (500). |

Deploy order for `track-match-history`: migration, then secrets, then
function. A function deployed first fails closed (every upload is refused). The
`tracked_match_recorders` migration must also run before the function that writes to it: the
Supabase GitHub integration deploys the function on merge, so push the migration by hand first.
Out of order, uploads still succeed but the recorder rows for that period are lost, because the
failed write is only logged.

## Premium launch order

Premium is dormant until configured, on both sides. The order matters:

1. Deploy `elevenlabs-agent-token` with `TEBEX_STORE_PUBLIC_TOKEN` still unset.
   Nothing changes for anyone.
2. Release the overlay with the store's public token, package-to-perk map and
   package to sell set. The overlay now gates Pulsa and sends the Overwolf
   session; the function still accepts everyone.
3. Set `TEBEX_STORE_PUBLIC_TOKEN` last. Setting it before step 2 stops Pulsa
   for every player. Set `PREMIUM_PULSA_PACKAGE_IDS` with it if only some
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
- `hero_aggregates.recorders` (issue 628, `20261108160000_hero_aggregate_recorders.sql`) is the
  number of different recorders (the user whose upload stored a match, as in `hero_pair_totals`) of
  the matches a hero appeared in, per half-season and mode. `fill_hero_aggregates` writes it, so the
  hourly rebuild and the purge's freeze fill it with no change of their own. It is null in a
  half-season frozen before the migration (the raw rows are gone) and never read as 0. Distinct
  recorders cannot be added across modes, so `read_hero_stats()` returns the count per mode row and a
  separate `blended_recorders` (issue 644, `20261108170000_hero_blended_recorders.sql`): the distinct
  recorders over Quick Match and Competitive together, written on the hero's row of each of those two
  modes and null on any other mode. Hero stats and the tier list use it as a gate (issue 640): a hero
  is placed only with 10 appearances and 2 recorders, read from `recorders` for one mode and from
  `blended_recorders` for the blend, and a missing blended count falls back to the largest per-mode count (it can only undercount), and a hero with neither falls back to the match-only rule. The count also reaches the Pulse Atlas ([pulse-atlas.md](pulse-atlas.md)). After `supabase db push`, run
  `supabase/checks/hero_aggregate_recorders.sql` and `supabase/checks/hero_blended_recorders.sql`.
- A matchup is stored, in each mode it was seen in, only when its decided matches summed over all
  modes of the half-season reach `hero_matchup_min_matches()`. The per-hero minimum (10, the tier
  rule) belongs to the code that derives tiers.
- A row that arrives in a half-season after the purge froze it is never counted, so a backfill must
  finish before the half-season it fills comes due.
- A rebuild failing inside the purge would stop deletion, which is why the hourly job exercises the
  same code long before any half-season is due.

## Extended upload (damage, healing, blocked, hero time, kill feed)

Issue 176. A newer overlay may add two optional fields to the `match` it sends to
`track-match-history`. Nothing about the existing fields changes, and an overlay that sends neither
is stored exactly as before (`record_match_participants` is called with the same arguments and
`tracked_matches` gets the same row; the reply has no `extended` key). The overlay issue that sends
them is `rivals_pulse` 1157.

| Field | Shape | Rules |
| --- | --- | --- |
| `match.match_player.hero_segments` | `[{ hero_id, seconds, damage_dealt, healing, damage_blocked }]` | The recorder's own figures, one entry per hero they played (a hero played twice is one entry, as `HeroSegment` already has it). `hero_id` is the game hero id as a number, the same id as a roster line's `cur_hero_id` (the app's `HeroSegment.heroId`, converted with `Number`). At most 20 entries; the first entry of a hero wins. Needs `match.match_player.player_uid`, which is how the figures are tied to the recorder's line in `participants`; without it they are dropped. |
| `match.hero_kills` | `[{ killer, victim, kills }]` | The kill feed as the app's `HeroKillCount`: lower-case hero slugs (`[a-z0-9-]`, at most 40 characters, the slugs the Counters screen uses) and a whole `kills` from 1 to 999. A pair listed twice is added up. At most 150 entries; a longer list is not a real feed and is dropped whole. |

How a value is read (`supabase/functions/track-match-history/extended-payload.ts`):

- **Omit what the app does not have.** An absent, null or malformed figure is stored as null, never 0.
  A real 0 (a support who dealt no damage) is kept. Send no `hero_segments` key at all for a match
  saved before segments existed, and no `hero_kills` key when none were counted.
- **A bad value costs only itself.** A figure outside its range (`seconds` 0 to 7200, the others 0 to
  1,000,000), not a number, or a negative one is dropped for that field; numbers sent as strings are
  read, fractions are rounded. A segment with no usable `hero_id` (a whole, positive game id) or no
  usable figure is dropped; a bad kill entry is dropped; the match itself is never refused for them.
  Nothing here can fail the upload: if the call that stores them errors, it is logged and the match,
  already stored, still succeeds.
- **No match totals.** The app's per-match `damageDealt`, `healing` and `damageBlocked` are not sent:
  they are the sum of the segments, and a total alone cannot be given to a hero. Accuracy, and the
  damage, healing or ultimate data of any roster line, are never read (ADR-0011 in the overlay repo).
- `banned_hero_ids` (overlay issue 1067) is a separate, unrelated field of `raw_payload` and is not
  touched by this contract.

Reply: `{"status":"ok","recorded":1,"participants":N}` as before, plus
`"extended":{"hero_figures":n,"hero_kills":n}` (rows written) only when the upload carried either
field. A repeat of the same match writes 0 for both, except that a second uploader still adds their
own figures.

Where it goes, and why it stays out of the old function:

- `record_match_extras(p_fingerprint, p_played_at, p_recorder_uid, p_hero_figures, p_hero_kills)` is a
  new function. The Edge Function calls it after `record_match_participants`, only when the upload
  carried the fields. `record_match_participants` keeps its exact signature: a `create or replace`
  with more arguments would add an overload and fail every upload with PGRST203. The call needs the
  match to be in `participants` already, so a kill feed is never stored for a match nobody recorded.
- `participant_hero_figures` rows belong to the recorder's `participants` line through a foreign key
  with `on delete cascade`, so retention and `forget_player` remove them with the line. It holds the
  line's id, not a uid or name.
- `match_hero_kills` holds hero slugs only. It is stored once per match: the first uploader's feed is
  kept and a second uploader's is ignored, so two recorders of one match are not double counted.
- All new tables have RLS on, no policy, and grants to `service_role` only.

What the numbers mean, so a reader does not over-read them:

- **Figures describe uploaders, not the lobby.** The app only knows its own player's damage, healing
  and blocked, so a `hero_figure_aggregates` row is "what recorders did on this hero". With one
  uploader it is one player's play.
- **The kill feed is what the recorder's client saw.** A kill it missed is not counted, and the first
  uploader's view is the one stored. `hero_kill_aggregates` counts those seen kills; `matches` is how
  many stored feeds had the pair and `hero_kill_totals.matches` is how many feeds there were.
- **Per minute** is `sum * 60 / seconds` using the `*_seconds` beside each sum (the time in exactly
  the segments that had that figure), never `seconds_sum`. Every `_n` is the count of segments with
  that figure, so a figure absent from older apps is not averaged as zero. No minimum sample is
  applied here; the code that shows a number applies its own.
- `play_mode_id` is the match's mode, -1 when the game did not say, as in `hero_aggregates`.

Recompute and freeze, like the hero aggregates: `recompute_extended_aggregates()` (hourly job
`recompute-extended-aggregates`) rebuilds every half-season that still has raw rows and is not
frozen. `purge_expired_participants()` calls `freeze_extended_aggregates()` after the hero
aggregates' freeze and before its first delete, so the counts are kept when the raw rows go. **Any
later migration that restates `purge_expired_participants` must keep calling every freeze** (see
[Hero pair aggregates](#hero-pair-aggregates)).

### Ability and ultimate counts

Issue 457. A newer overlay (overlay issue 1284) may add a third optional field. A body without it is
stored exactly as before.

`match.match_player.hero_ability_uses` is `[{ hero_id, slot, uses, kills_after, assists_after }]`:

- `hero_id` is the game hero id as in `hero_segments`. Needs `match.match_player.player_uid`; without it the list is dropped. Roster lines are never read.
- `slot` is `ability_0` to `ability_4` (the feed's `ability_cooldown_0` to `_4`), `team_up_0` or `team_up_1` (`additional_ability_cd_0` and `_1`), or `ultimate`. An unknown slot drops that entry.
- `uses` is a whole number from 0 to 999. Send 0 for a slot the app watched and the player never used. Leave out a slot the app did not watch: no row means unknown, and it is not averaged as 0.
- `kills_after` and `assists_after` are whole numbers from 0 to 999, or omitted when not counted. The window (the overlay's starting values are 5 seconds after an ability and 10 after an ultimate) belongs to the overlay.
- At most 160 entries (20 heroes in 8 slots); a longer list is dropped whole. The first entry of a hero and slot wins, and a repeat of the match writes nothing.

The reply's `extended` gains `ability_uses` (rows written) only when the upload carried a usable list, and appears for an upload with only that list. A missing key means unknown. If the call fails, it is logged and the match still succeeds. `hero_ability_aggregates` keeps the counts, rebuilt and frozen with the other extended aggregates, and no read function publishes them yet.

### Hero timelines

Issue 654. A newer overlay may add a fourth optional field. A body without it is stored exactly as
before, and its reply is unchanged.

`match.hero_timelines` is `[{ team, picks: [{ hero_id, at_second }] }]`, one entry per human player, with no uid and no name:

- `team` is the scoreboard's `camp`, 0 to 9. `hero_id` is the game hero id. `at_second` counts from the start of the match, 0 to 7200 (fractions are rounded), and never goes back within a player's picks.
- At most 12 players and 20 picks per player; a longer list is not a real one and the whole field is dropped. An entry with a bad team, no picks, a bad pick or seconds that go back is dropped alone.
- A team is kept only when the last hero of each of its timelines matches that team's scoreboard heroes (`match.match_players`) as a multiset. A team with a missing or dropped timeline, or a different final hero, is dropped whole; the other team is kept.
- The database stores a timeline whole or not at all, once per match: the roster fingerprint plus the start time, the first uploader's wins, within the 4 minute window `record_match_participants` uses. `match_hero_timelines` is deleted by `purge_expired_participants` on the schedule of `match_hero_kills`.
- Issue 666. Every stored pick also carries `recorded_by`, the hash of the user whose upload stored the timelines (the same keyed hash `participants.recorded_by` holds, never a username). The function takes it as `p_recorded_by`, a fourth argument that defaults to null, so the Edge Function deployed before this change keeps working until it is redeployed; the migration drops the three argument version because a plain `create or replace` would leave two overloads and PostgREST could not choose between them (PGRST203). Rows stored before the migration, or by a caller that sends none, stay null. The column is never granted to `anon` or `authenticated`. Push the migration before deploying the Edge Function: an Edge Function that sends `p_recorded_by` to the old function fails that call, which is logged and costs only the timelines.

The reply's `extended` gains `hero_timelines` (player timelines written) only when the upload carried a usable list, and appears for an upload with only that list. A missing key means unknown. If the call fails, it is logged and the match still succeeds. Check the migration with `npx supabase db query --linked -f supabase/checks/match_hero_timelines.sql`.

### Who contributed, and when a figure is published

`hero_figure_aggregates` records `recorders` and `top_recorder_segments` per hero, and the same pair per figure. `hero_kill_aggregates` records `recorders` and `top_recorder_matches`. Numbers only, never who. A row frozen before these columns existed reads 0 and never qualifies.

`hero_figure_qualifies(matches, recorders, top)` is the one rule: 10 or more matches, 2 or more players, and the busiest player at most `community_max_recorder_share_percent()` of the matches (100, so no cap; the starting rule was 50). "Matches" means segments (one player on one hero in one match), so two uploaders in one lobby count twice. These are starting values. Restate that one function in a new migration to change them; nothing needs rebuilding, because the rule runs when the numbers are read. If the player minimum changes, change `COMMUNITY_FIGURES_MINIMUMS` and `COMMUNITY_KILLS_MINIMUMS` too, which only print it (a test compares them). To lower the 10, also lower the website's own `heroLines` and `pairMatches`, which filter again after pooling.

The website reads through `read_community_hero_figures()` and `read_community_kill_feed()` (service role only). A figure that fails is sent as zero lines, sum and seconds, a hero whose three figures all fail is absent, and a kill pair that fails is absent. The rule is applied per half-season and mode before anything is summed.

`read_community_hero_scores()` (service role only) is the third reader, behind the 1 to 10 scores in [hero-build-scores.md](hero-build-scores.md). It returns every row of `hero_figure_aggregates` and `hero_ability_aggregates`, because a hero below the rule must be able to say how far along it is. A row or figure that fails the rule keeps its line and player counts, and whether one player is above the published share (`community_max_recorder_share_percent()`, so never at 100; `20261108150000` restated the flags, which were a fixed half), with every sum at 0. The busiest player's own count never leaves the database.

A uid is the client's claim, as it is for figures (see "Reading a linked player's own dashboard"), so contributor counts trust it.

The aggregates leave out a segment with time played and no figure above 0, which looks like figures the feed never sent (overlay issue 1161), and count a figure only on segments with a time played above 0. A half-season is corrected at its next rebuild; a frozen one is never rebuilt.

## Hero pair aggregates

`hero_pair_aggregates` keeps, per half-season, game mode, rank bucket and pair of heroes, how often the
pair met on opposite teams (`vs`) or played together on one team (`with`). `hero_pair_totals` keeps,
per half-season, mode and rank bucket, the matches counted and, as numbers only, how many distinct
recorders made them and how many matches the busiest one did. Neither table holds a uid, name,
fingerprint or per-player row, both have RLS on with no policy, and only the service role reaches
them. It is a family of its own, like the extended aggregates: `fill_hero_aggregates` is untouched.

- `vs` is directional and counted like `hero_matchups`. `with` is stored once per unordered pair
  (`hero_id < other_hero_id`) and counted once per team occurrence: a team in a match where two
  different players played the two heroes. A match where both teams field the pair adds two
  occurrences (`decided_lines`, `wins`) and one match. The same hero twice on a team is not a pair.
  A team's result is the result its lines agree on.
- A pair is stored, in every mode and bucket it was seen in, only when its decided matches summed over
  the half-season reach `hero_pair_min_matches()` (10).
- `rank_bucket` is -1 (unknown) on every row today: no rank is stored with an upload. Buckets of 0 or
  more are reserved for 100-point buckets of the recorder's rank score once one is stored (issue
  337); `fill_hero_pair_aggregates` is the one place that will derive it.
- `recompute_hero_pair_aggregates()` rebuilds every half-season that still has raw rows and is not
  frozen (hourly job `recompute-hero-pair-aggregates`). `purge_expired_participants()` calls
  `freeze_hero_pair_aggregates()` before its first delete. **Any later migration that restates the
  purge must keep calling every freeze**; a test reads the latest definition and fails if one is gone
  or comes after a delete. Half-seasons whose raw rows were already purged before this migration ran
  have no pair counts and cannot be filled.
- `read_hero_pairs(p_play_mode_ids)` (granted to `anon` and `service_role`, as `read_hero_matchups`
  is) returns `half_season, rank_bucket, kind, hero_id, other_hero_id, decided_matches, decided_lines,
  wins`, summed over the modes asked for (default Quick Match and Competitive), with the minimum
  applied again to the sum. Rank bucket -1 is returned without a recorder gate, as `hero_matchups` is
  today; a bucket of 0 or more only from the (half-season, mode, bucket) rows whose own totals pass
  `community_bucket_shown`, checked before the modes are summed: gating a combined figure would let a
  caller subtract one list of modes from another and recover a hidden mode. Recorder counts are never
  returned. It returns a set of rows, so a caller that reads more than 1000 of them pages through it
  with a range and an explicit `order`, not the function's return order. The website reads it through
  `GET /api/hero-pairs` ([`src/server/heroes/pairs/hero-pairs-read.ts`](../src/server/heroes/pairs/hero-pairs-read.ts)), which pages with
  `limit`, `offset` and `order=half_season,rank_bucket,kind,hero_id,other_hero_id` until a page comes
  back empty, for Competitive and Quick Match, and builds the "all" band from rank bucket -1 alone;
  Pulse Atlas publishes that answer as `community-stats` ([pulse-atlas.md](pulse-atlas.md)).
- Once a rank source exists, an all-ranks total built by adding buckets would include a bucket that
  was hidden; whoever adds that must not publish it next to the visible ones. `read_hero_matchups`
  already publishes ungated all-ranks `vs` counts, so `vs` rank buckets of 0 or more cannot be
  published while it stays ungated: a bucket could be recovered by subtracting the rest from its
  all-ranks total.
- The migration checks the gate when it runs, on fixtures in a half-season that does not exist (a
  one-recorder bucket must not come back, a three-recorder bucket must, alone and with the other
  mode asked for); the fixtures are rolled back.

## Triple-support aggregates

`triple_support_trios` keeps, per half-season, game mode, rank bucket and trio of Strategists, how often a
team ran exactly those three in a match with a result and how often it won. `triple_support_totals`
keeps, per half-season, mode and rank bucket, the matches counted, as numbers only how many distinct
recorders made them and how many matches the busiest one did, and the teams behind a trio's share.
Neither table holds a uid, name, fingerprint or per-player row, both have RLS on with no policy, and
only the service role reaches them. It is a family of its own, built like hero pairs: its own fill,
rebuild, recompute and freeze, and no other family is touched.

- **Who is a Strategist.** The rebuild runs in the database (hourly, and in the purge), so it cannot ask
  the website. `hero_game_roles` is one row per game hero id with `base_game_id` and `role`, seeded in
  the migration from `data/pulse-atlas/hero-game-ids.json` and the live hero list. Deadpool has rows
  for his three role forms only (10571 Vanguard, 10572 Duelist, 10573 Strategist, all with base id
  1057): his base id 1057 and hero id 0 ("no hero recorded") have no row. **A new hero needs a row in
  the same pull request that adds it to `hero-game-ids.json`**, as a new migration that upserts it;
  `scripts/hero-game-roles-seed.test.ts` fails when the two disagree, and when the Strategists differ
  from `data/pulse-atlas/strategist-tags.json`. The healer or utility tag is not in the database: it only
  names a trio, and the website does that when it reads.
- **Which teams count.** A team is one side of a match that has a result. `hero_id` is the hero a player
  ended the match on. The team is **unresolved** if any of its lines has no row in `hero_game_roles` (no
  hero, id 0, 1057, a hero not yet added); it is counted in `unclassified_teams`, never as a trio and
  never silently dropped. A resolved team is **classified** (`classified_teams`, the denominator of a
  trio's share; a team with fewer than six stored lines, for example because a player asked to be
  forgotten, is still classified from the lines that remain, so its Strategist count can be low). A classified team with exactly three Strategists adds one occurrence (`teams`, and
  `wins` if it won) to its trio, keyed by the three base game ids ascending (Deadpool's Strategist form
  under 1057). A classified team with four or more Strategists is counted in `four_plus_teams` as that
  shape only: its heroes are not stored. A match counts once however many people recorded it (a match
  is its roster fingerprint plus start time, and a second upload is dropped on arrival); a match where
  both teams run the same trio adds two `teams` and one `matches`.
- A trio is stored, in every mode and bucket it was seen in, only when its matches summed over the
  half-season reach `triple_support_min_matches()` (10). `rank_bucket` is -1 (unknown) on every row
  today, as for hero pairs; `fill_triple_support_aggregates` is the one place that will derive it.
- `recompute_triple_support_aggregates()` rebuilds every half-season that still has raw rows and is not
  frozen (hourly job `recompute-triple-support-aggregates`, minute 47).
  `purge_expired_participants()` calls `freeze_triple_support_aggregates()` before its first delete.
  **Any later migration that restates the purge must keep calling every freeze**; the test described
  under hero pairs reads the latest definition and fails if one is gone. Half-seasons whose raw rows
  were purged before this migration ran have no trio counts.
- `read_triple_support_trios(p_play_mode_ids)` (granted to `anon` and `service_role`) returns
  `half_season, rank_bucket, hero_a, hero_b, hero_c, matches, teams, wins, classified_teams,
  unclassified_teams, four_plus_teams`, summed over the modes asked for (default Quick Match and
  Competitive), with the minimum applied again to the sum. The four team counts are the half-season's,
  repeated on each trio row. The recorder gate is the one hero pairs use: rank bucket -1 is returned
  ungated, a bucket of 0 or more only from the (half-season, mode, bucket) rows whose own totals pass
  `community_bucket_shown`, checked before the modes are summed and applied to the team counts as
  well. Recorder counts are never returned. The website reads it through
  `GET /api/triple-support-trios`
  ([`src/server/heroes/trios/triple-support-trios-read.ts`](../src/server/heroes/trios/triple-support-trios-read.ts)),
  which pages with `limit`, `offset` and `order=half_season,rank_bucket,hero_a,hero_b,hero_c` until a
  page comes back empty, builds the figures from rank bucket -1 alone, and names each trio from
  `strategist-tags.json` and the hero names ([pulse-atlas.md](pulse-atlas.md#the-strategist-tags-data)).
- The migration checks the gate when it runs, on fixtures in a half-season that does not exist, and
  rolls them back. Nothing in the repository runs the SQL counting itself (no test database), so after
  applying the migration run `npx supabase db query --linked -f supabase/checks/triple_support_trios.sql`:
  it records fixture matches in a half-season that does not exist (a trio at the minimum, a duplicate
  upload, four Strategists, hero id 0, Deadpool's base id), rebuilds, asserts the counts and
  permissions, and rolls back. `supabase/functions/track-match-history/triple-support-migrations.test.ts`
  reads the SQL for the posture and shape rules.

## Team line-up aggregates

`team_lineup_shapes` keeps, per half-season, game mode, rank bucket and shape, how many classified teams
ran it in a match with a result and how many won. A shape is the Vanguard-Duelist-Strategist count of one
team at the end of the match (`hero_id` is the hero a player ended on), such as 1-2-3; triple support is
every shape with three or more Strategists. The table holds no uid, name, fingerprint, recorder or hero
id, RLS is on with no policy, and only the service role reaches it.

- **Part of the triple-support family, not a family of its own.** A shape needs exactly what the trio
  rebuild already computes: the role of every hero on a team (`hero_game_roles`), the same duplicate
  handling, the same unresolved-team rule and the same totals. So `fill_triple_support_aggregates` writes
  the shapes in the same statement as the trios and totals (the migration restates it with the shapes
  added; a test compares the trio and totals writes with the earlier definition and fails if they
  change), and `rebuild_triple_support_aggregates` empties the shapes with them. Nothing else is
  restated: the existing hourly job (`recompute-triple-support-aggregates`, minute 47) rebuilds shapes,
  `freeze_triple_support_aggregates()` freezes them, and `purge_expired_participants()` is untouched, so
  it cannot lose a freeze call. A half-season frozen before this migration has no shapes.
- **Which teams count.** The rules of the triple-support section hold: a team with a hero that has no row
  in `hero_game_roles` (id 0, Deadpool's base id 1057, an unknown id) is unclassified, counted in
  `triple_support_totals.unclassified_teams`, and never in a shape. A classified team with a result adds
  one occurrence to its shape, so a mirror match adds two; a match uploaded twice is one match (the
  second upload is dropped on arrival). The number of players on a team is not checked, so a team with
  fewer than six lines (a player who set `do_not_store` is skipped at upload, and `forget_player` removes
  a line later) is classified from the lines that remain and shows a shape one short. A follow-up should
  treat such a team as unresolved in both families.
- **Pick rate and win rate.** The pick rate is a shape's `teams` over `classified_teams` of the same
  half-season, mode and bucket (always the sum of that bucket's shapes); the win rate is `wins` over
  `teams`. Both are computed by the website from counts.
- **The minimum.** Every shape seen is stored (three small numbers each). `team_lineup_min_teams()` (50,
  matched by `TEAM_LINEUP_MIN_TEAMS` on the website; a test compares the two) is applied by the reader to
  the teams summed over the modes asked for: a shape under it comes back with `enough_data` false, its
  `teams` so far (from `20261108140000`; it was null before) and null `wins`, which the site shows as
  "not enough data yet" and the Pulse Atlas publishes as progress toward the minimum.
- `read_team_lineup_shapes(p_play_mode_ids)` (granted to `anon` and `service_role`; default Competitive,
  mode 1) returns `half_season, rank_bucket, vanguards, duelists, strategists, teams, wins, enough_data,
  classified_teams, unclassified_teams`. The two team counts are the half-season's, repeated on each
  row, and use the same recorder gate as the trio reader (rank bucket -1 ungated; a bucket of 0 or more
  only from the (half-season, mode, bucket) totals that pass `community_bucket_shown`, checked before
  the modes are summed). A half-season and bucket with only unclassified teams comes back as one row
  with null shape columns. Recorder counts are never returned. The website reads it through
  `GET /api/team-lineups`
  ([`src/server/heroes/lineups/team-lineups-read.ts`](../src/server/heroes/lineups/team-lineups-read.ts)),
  which builds the figures from rank bucket -1 alone and refuses a full 1,000-row page instead of
  paging, because a half-season has a few dozen shapes at most.
- The migration checks the gate and the minimum when it runs, on fixtures in a half-season that does not
  exist, and rolls them back. Nothing in the repository runs the SQL counting itself (no test
  database), so after applying the migration run
  `npx supabase db query --linked -f supabase/checks/team_lineup_shapes.sql`: it records 100 fixture
  Competitive matches in a half-season that does not exist (shapes at and under the minimum, a mirror
  match, a duplicate upload, hero id 0, Deadpool's base id and role form), rebuilds, asserts the counts,
  the reader, the freeze and the permissions, and rolls back.
  `supabase/functions/track-match-history/team-lineup-migrations.test.ts` reads the SQL for the posture
  and shape rules.
- **`hero_game_roles` against the live hero list.** `npm run check:hero-game-roles` (service role,
  read-only) compares the table with `hero_content` and `hero-game-ids.json` and lists every missing,
  wrong or stray row, Vanguard and Duelist included; `scripts/hero-game-roles-seed.test.ts` can only check
  the Strategists offline. Run it after the hero sync and after any migration that touches the table.

## Hero switch-in aggregates

Issue 655. `hero_switch_ins` keeps, per half-season, game mode, hero switched to and enemy hero, how
often a team won after one of its players switched to the hero while the enemy hero was on the field,
from `match_hero_timelines` (see "Hero timelines") and the scoreboard.
`hero_switch_in_aggregate_half_seasons` holds the rebuild and freeze times. Neither holds a uid, name,
fingerprint or per-player row, both have RLS on with no policy, and only the service role reaches them.
It is a family of its own, built like the hero pair aggregates: `fill_`, `rebuild_`, `recompute_` and
`freeze_hero_switch_in_aggregates`, the hourly job `recompute-hero-switch-in-aggregates` (minute 53),
and `purge_expired_participants()` calling the freeze before its first delete. **Any later migration
that restates the purge must keep calling every freeze**; a test reads the latest definition and fails
if one is gone or comes after a delete.

- **A switch** is a pick that follows a player's first pick and names a different hero than the pick
  before it. The first pick is not a switch, and neither is a repeat of the same hero. A hero is its
  base id from `hero_game_roles` (issue 667): Deadpool's role forms 10571 to 10573 are all 1057, so a change of
  form is no switch, and the rows are stored under 1057, as the hero and as the enemy. The overlay already folds
  back-to-back picks of one hero into one, so a direct form change rarely arrives; a change through another
  hero (Deadpool, Rocket, Deadpool on another form) is a real switch to Deadpool. The merge is done here, before
  counting, because a count cannot be un-merged: summing rows of several forms would count a match in each.
- **Credit.** A switch is credited once to every distinct enemy hero on the field at its `at_second`:
  for each timeline of a team other than the switching team, the latest pick at or before that second.
  Two enemy players on one hero are one credit. A switch with no enemy pick yet is credited to nobody.
  Rows hold `switches` (credits) and `matches` (distinct matches they came from), whatever the result,
  `decided_switches` and `decided_matches` (the same over teams with a result), and `wins` (credits
  whose switching team won). A win rate is `wins / decided_switches`.
- **Outcome** is the switching team's result in `participants`, read as the pair family reads a team's
  result. A switch whose team has no result stays in `switches` and `matches` and out of every
  `decided_` figure until a late upload fills the result in and the next hourly rebuild counts it.
- **Teams are independent.** The first uploader's timelines are all a match has, and a team that failed
  the upload's scoreboard check was dropped, so a match can have timelines for one team only. A switch
  needs its own team's timeline and an enemy team's timeline; one without either is skipped and the
  rest of the match still counts.
- **Recorders.** A row records how many distinct recorders its matches came from and how many matches
  the busiest one did, over the decided matches, as numbers only. The recorder of a match is the one whose
  upload stored its timelines (`match_hero_timelines.recorded_by`, issue 666), and the one whose upload stored its
  scoreboard when the timelines carry none (rows stored before issue 666 or sent by an app that sent none), decided
  match by match. Both the player count and the busiest player's share use it, so a scoreboard from one player
  and timelines from another credit the player who sent the timelines.
- **Mode.** The match's mode, read once per match. The reader's default is Quick Match and Competitive.
- `read_hero_switch_ins(p_play_mode_ids)` (granted to `anon` and `service_role`) returns one jsonb value
  `{ "switch_ins": [{ half_season, hero_id, enemy_hero_id, decided_matches, decided_switches, wins }] }`, summed over
  the modes asked for, so PostgREST's 1000-row page limit never cuts it short. A (half-season, mode)
  row is included only when `hero_figure_qualifies` passes for it (10 decided matches from 2 players, the
  busiest player within `community_max_recorder_share_percent()`), checked before any modes are summed:
  gating a combined figure would let a caller subtract one list of modes from another and recover a
  hidden mode. The rows are stored whatever their size and the gate runs when they are read, as for the
  kill feed. Recorder counts are never returned. The migration checks the gate when it runs, on
  fixtures in a half-season that does not exist (a one-recorder row must not come back, a
  three-recorder row must, and a three-recorder row of 9 matches must not, alone and with the other
  modes asked for); the fixtures are rolled back.
- The website reads it through `GET /api/hero-switch-ins`
  ([`src/server/heroes/switch-ins/hero-switch-ins-read.ts`](../src/server/heroes/switch-ins/hero-switch-ins-read.ts)),
  which sets each pairing beside the hero's overall record against that enemy from `read_hero_matchups`
  in the same half-season, with Deadpool's role forms merged under one hero. The rows already hold
  Deadpool as 1057; if several game ids of one hero ever reach it (a form kept from before issue 667), it
  takes the largest `matches` of them rather than their sum, since a match may sit in each, and adds their
  switches and wins. It prints the 10 matches
  and 2 players of `hero_figure_qualifies` (`SWITCH_IN_MIN_MATCHES`, `SWITCH_IN_MIN_PLAYERS`), which a
  test compares with the latest definition. The hero page's Matchups tab shows it as "Switch-ins".
- Players switch more when they are losing, so a switch-in win rate runs low. The page says so and
  shows the hero's overall record against the same enemy beside it. A switch is credited to every enemy
  hero on the field, so it is a co-occurrence, not proof that the switch was made to counter that hero.
- **Run the check** after `supabase db push`:
  `npx supabase db query --linked -f supabase/checks/hero_switch_ins.sql` (fixtures in half-seasons 994 to 998, rolled back; includes nine matches from three players that must stay hidden, ten matches whose timelines one player uploaded though two uploaded the scoreboards, which must stay hidden, and ten matches of Deadpool's role forms that must come out as one hero). It proves the counting rules, the reader, and that the purge freezes the counts
  before it deletes the timelines.
- Until the overlay sends `hero_timelines` (issue 654), the table stays empty and the hero page shows
  its empty state. Half-seasons whose raw rows were purged before this migration cannot be filled.

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
  PostgREST with plain `fetch` and the publishable key ([`src/server/heroes/stats/hero-stats-read.ts`](../src/server/heroes/stats/hero-stats-read.ts)).
  Vercel needs `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; the service-role key is not used for this.
- `read_hero_matchups(p_play_mode_ids)` returns hero against enemy hero, summed over the chosen modes
  (default Competitive and Quick Match). `hero_matchups` keeps a matchup only when its decided
  matches over all modes reach `hero_matchup_min_matches()`, so the function applies the minimum
  again to the chosen modes' own sum. Each row also carries `kills_sum`, `kills_n`, `deaths_sum`,
  `deaths_n`, `assists_sum`, `assists_n`, `final_hits_sum` and `final_hits_n` (issue 651): the figures of
  the decided lines, one line per enemy hero faced, summed over the modes. They are null for a
  half-season the purge froze before they existed, and `rebuild_hero_aggregates` cannot refill a
  frozen one. The server reads a missing or null figure as "not counted", never as 0. The website reads it through `GET /api/hero-matchups`
  ([`src/server/heroes/matchups/hero-matchups-read.ts`](../src/server/heroes/matchups/hero-matchups-read.ts)), always for Competitive and Quick Match.

Every rate, tier and KDA is derived in one pure module, [`src/server/heroes/stats/hero-stats.ts`](../src/server/heroes/stats/hero-stats.ts),
and served by `GET /api/hero-stats`. The rules, which are the overlay's personal tier list:

- A hero is placed once it has 10 appearances in matches with a win or a loss and at least 2 recorders
  (`COMMUNITY_BUCKET_MIN_PLAYERS`). A hero whose recorders were never counted (null, in a half-season
  frozen before the count) is placed on the 10 appearances alone. Its tier comes from
  the shrunk win rate: the record plus a prior of pretend matches at its role's average win rate
  (the overall average for a role with fewer than 3 heroes). The prior's size is estimated from the
  spread of the heroes counted, between 10 and 500 pretend matches, by
  [`win-rate-prior.ts`](../src/server/heroes/stats/win-rate-prior.ts), the overlay's own estimator;
  with fewer than 5 heroes it is 60 pretend matches at 50%. Tiers: S from .62, A .56, B .52, C .48,
  D .44, else F. The matchup and synergy win rates keep the fixed 10 pretend matches at 50%.
- A hero's "appearances" are its scoreboard lines (a hero on both teams of one match counts twice,
  as in the overlay); the pick rate is those lines over the matches counted.
- By default Competitive and Quick Match (`play_mode_id` 0 and 1) are blended, and unknown (-1) is
  left out. `GET /api/hero-stats?mode=<id>` counts one mode on its own instead: `quick-match` (0),
  `competitive` (1), `arcade` (2) or `practice` (3); `all` is the blend. A value that names no mode
  gets the empty state, not the blend, and no option ever counts -1. The list is `PLAY_MODES` in
  [`src/server/heroes/stats/hero-stats.ts`](../src/server/heroes/stats/hero-stats.ts), shared with the role benchmarks. Every answer carries
  `mode` (the id counted, or null for a value that named none) and `modes[]` (`id`, `label` and
  `decidedMatches` for each mode in the half-season shown); `matchesCounted` is the selected mode's
  `decidedMatches`. `mode` combines with `halfSeason`, and the fall-back to the previous half-season
  below is decided for the selected mode alone. Pulse Atlas and the home page never pass a mode.
  The site's Stats Heroes tab (its tier list and win rates table) and Roles tab build their mode pickers from the list,
  offering only modes with a decided match and never Practice while `SHOW_PRACTICE_MODE` in
  [`play-modes.ts`](../src/app/shared/utilities/play-modes.ts) is off (the overlay uploads Practice
  bots as players: rivals_pulse#1166). A request for the blend carries no `mode`.
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
4 for the fourth and later), with `recorders` (the number of different players behind the bucket) and `top_recorder_matches` (how
many of its matches the busiest one recorded). It holds no player id, uid, name or per-match row. RLS is on with no policy, and only the service role
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
- `read_community_insights()` (granted to `service_role` only) returns the session gap, the gates and,
  per shown bucket, a whole-number `share_percent` and `win_rate_percent`. It returns no counts: every
  dimension adds up to the same matches, so an exact count would let a bucket hidden in another
  dimension be found by subtraction. A bucket is shown only if its own half-season row has at least
  `insights_min_matches()` (10) matches, at least
  `insights_min_recorders()` (1) player, and
  no one player over `insights_max_recorder_share_percent()` (100) of its matches, so today the player numbers hold nothing back; the rows that pass
  are added over half-seasons inside the function. A share is over the shown buckets of its dimension
  only, a dimension with fewer than `insights_min_shown_buckets()` (3) shown buckets is left out, and a
  win rate is null with fewer than 10 results. Raising the player numbers in a new migration brings the
  database gate back with no rebuild. The API's player minimum, the tab wording and the Privacy text went
  with the old rule and must return with it (issue 480, before other players are invited).
- The server calls it with the shared client and labels the answer in
  [`src/server/community/insights/community-insights.ts`](../src/server/community/insights/community-insights.ts), served by `GET /api/community/insights`.
  A function or table that does not exist yet (PGRST202, 42883, 42P01) gives the empty state with HTTP
  200; any other failure keeps its error status (epic 170 error policy).

### Role benchmarks (Community Stats tab)

`GET /api/community/stats` (and the Community Stats tab) pools the same per-hero counts by role. It
adds no table, migration or function: `hero_aggregates` already holds, per half-season, mode and
hero, the decided lines, wins, and the sums of kills, deaths, assists and final hits with their own
non-null counts, and it is rebuilt hourly and frozen by the purge before the rows go. The server
reads `read_hero_stats()` (so the same environment as above) and a role per hero from
`hero_content`, through the shared Supabase client, which needs `SUPABASE_SERVICE_ROLE_KEY`.
[`src/server/heroes/stats/role-stats.ts`](../src/server/heroes/stats/role-stats.ts) derives everything:

- A role is the sum of its heroes, so each figure is an average over scoreboard lines pooled across
  everyone, never an average of per-player averages. KDA uses the hero definition above.
- A hero's role is the one it has now. Deadpool counts toward the role of the id the match
  reported (his role variants in `hero-game-ids.json`). A game id with no role is left out and logged.
- Modes: the same `PLAY_MODES` list as the hero numbers, always every one of them in one answer
  (the blend, then Quick Match, Competitive, Arcade and Practice, each alone). Unknown is left out.
  The half-season is chosen by the blend, so a half-season with only Arcade or Practice lines still
  falls back to the previous one.
- A role in a mode shows figures at `ROLE_STATS_MIN_LINES` (50) decided lines; each average also needs
  that many lines carrying the figure, so older apps' missing final hits are never read as zero.
- If `read_hero_stats()` is not in the database yet (PostgREST 404 or `PGRST202`, or Postgres
  `42P01` / `42883`) the answer is the empty state with HTTP 200. Any other failure (a refused key, a
  5xx, a timeout, missing environment variables) is an error status and the tab says it cannot load
  the benchmarks: the policy on epic 170, so an outage is never hidden behind "not enough data".

## Community match aggregates

The Community Matches tab (issue 172) reads its own anonymous counts, kept apart from the hero
aggregates so a change to one cannot break the other. The four tables have RLS on and no policy,
nothing for `anon` or `authenticated`, and hold counts only: no uid, name, fingerprint or per-player
row.

- `community_map_aggregates` per half-season, mode and map: matches, matches with a known result, wins.
  Every bucket row in the three tables also stores `recorders` (how many distinct recorders
  contributed) and `top_recorder_matches` (how many matches the busiest one contributed): counts only,
  never who.
- `community_mode_aggregates` per half-season and mode: matches, and the summed match length with the
  count of matches it was summed over (a match with no length is never averaged in as zero).
- `community_day_aggregates` per half-season and UTC day: matches.
- A match is its roster fingerprint plus its start time, so a match recorded by two players counts once.
- The result of a match is read from the recorder's side. A recorder's line in `participants` is
  found by their in-game uid (inside the function only, never stored). Their own win or loss and the
  match length come from their `tracked_matches` row for this match: the row nearest in time within
  the four minutes that count as one match, preferring the row whose map is the match's map when two
  are equally near. A recorder whose rows cannot be told apart gives none, because either could be
  another match. When recorders on both teams uploaded the match, the earliest upload is the one that
  counts, so a match is never both a win and a loss. A match with no such row still counts as a match
  but is left out of win rates and averages.
- **Gate.** `community_tab_bucket_shown` lets a bucket (a map in a mode, a mode, a day) through at 10
  matches, on the same numbers as the Insights read, from any number of players (issue 449).
  `read_community_matches()` applies it, so a hidden bucket never leaves the database, and every total
  the site shows is computed over the shown buckets only. The stricter `community_bucket_shown` (2
  players, with the same share limit) now gates only the hero pair, triple support and line-up rank bands.
- `recompute_community_match_aggregates()` rebuilds every half-season that has raw rows and is not
  frozen; the hourly `recompute-community-match-aggregates` pg_cron job runs it. It freezes a
  half-season a week after the next one began (uploads are refused once a match is a week old), or
  when its oldest raw row is five months old, ahead of the purge's six-month limit. A frozen
  half-season is never rebuilt, and `purge_expired_participants()` is not touched: it deletes only
  after the next half-season has ended, long after this freeze.
- `read_community_matches()` returns one jsonb value of counts and half-season start dates and is
  granted to `service_role` only. The server calls it through the shared client
  ([`src/server/community/matches/community-matches-read.ts`](../src/server/community/matches/community-matches-read.ts)) and derives every rate, share
  and average in [`src/server/community/matches/community-matches.ts`](../src/server/community/matches/community-matches.ts); until the migration is
  applied the call fails with a "function not found" error, which the server turns into the empty
  state.
- **No bucket count leaves the server.** A hidden bucket could be recovered by subtracting the shown
  ones from their total, so `GET /api/community/matches` returns only whole-percentage win rates and
  shares and average lengths rounded to the minute for its buckets. The one exact count it carries is
  `matchesCounted`, the half-season's matches from `read_game_counts()` (see "Website game stats"), which
  `GET /api/game-stats` already lists in full. Maps are ordered by win rate, never by volume,
  and a map under its minimum is named without a count. `src/server/community/matches/community-matches.spec.ts` proves no
  number equal to a bucket count is returned.
- `GET /api/community/matches[?halfSeason=<number>]` is the tab's data. Minimums (named in
  `COMMUNITY_MATCHES_MINIMUMS`): 10 shown matches for the mode mix and matches per day,
  10 matches with a result for a map's win rate, 10 matches with a length for an average. While the
  current half-season is below 10 matches and the previous one is not, the previous one is returned
  with `inPlaceOf` naming the current one.

After applying the migration, compare the tables with a direct count (replace `10.5` as needed); the
two matches columns must agree, and a second `select public.recompute_community_match_aggregates();`
must leave the checksum unchanged:

```sql
select (select count(*) from (select distinct fingerprint, played_at
          from public.participants where half_season = 10.5) x) as direct_matches,
       (select coalesce(sum(matches), 0) from public.community_mode_aggregates
          where half_season = 10.5) as aggregated_matches,
       (select coalesce(sum(matches), 0) from public.community_day_aggregates
          where half_season = 10.5) as aggregated_days;

select md5(string_agg(r, '|' order by r)) as checksum from (
  select 'm' || to_jsonb(a)::text as r from public.community_map_aggregates a
  union all select 'o' || to_jsonb(a)::text from public.community_mode_aggregates a
  union all select 'd' || to_jsonb(a)::text from public.community_day_aggregates a
) t;
```

## Each half-season

Retention deletes a scoreboard row once the half-season after its own has
ended. It needs to know when each half-season started. Add a row on the day a
new one begins, from the game's season announcement:

```sql
insert into public.half_seasons (half_season, starts_at)
values (11.0, '2026-11-13T09:00:00Z')
on conflict (half_season) do nothing;
```

If a row is missed, rows are still deleted six months after the match (the
policy's hard limit), but later than promised.

## After setup

- **Required:** `select jobname from cron.job where jobname in
  ('purge-expired-participants', 'purge-cron-run-history', 'recompute-hero-aggregates',
  'recompute-extended-aggregates', 'recompute-play-time-aggregates',
  'recompute-community-match-aggregates', 'recompute-hero-pair-aggregates',
  'recompute-triple-support-aggregates', 'purge-link-data');` must
  show all nine jobs (two daily jobs, the participant purge and the run history cleanup, the six
  hourly aggregate rebuilds and the five-minute link purge). If one is missing (the migrations warn
  when `pg_cron` is unavailable), enable `pg_cron` and schedule by hand
  `select public.purge_expired_participants();` daily,
  `delete from cron.job_run_details where coalesce(end_time, start_time) < now() - interval '7 days'` daily,
  `select public.recompute_hero_aggregates();`, `select public.recompute_extended_aggregates();`,
  `select public.recompute_play_time_aggregates();`,
  `select public.recompute_community_match_aggregates();` and
  `select public.recompute_hero_pair_aggregates();`,
  `select public.recompute_triple_support_aggregates();` hourly, and `select public.purge_link_data();`
  every five minutes. `supabase/checks/cron-run-history.sql`
  proves the cleanup against the linked project and rolls back:
  `npx supabase db query --linked -f supabase/checks/cron-run-history.sql`.
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
[`src/server/supabase/supabase-client.ts`](../src/server/supabase/supabase-client.ts). Reuse it; do not create
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

## Website accounts (profiles)

Visitors sign in with Discord through Supabase Auth; the design is in
[ADR-0004](decisions/0004-add-player-accounts-private-to-the-owner.md) and the web side in
[architecture.md](architecture.md). The first table the web app added for it is `public.profiles`
(`user_id` references `auth.users` on delete cascade, `created_at`), with RLS on, no grant to `anon`,
and `select` and `insert` for `authenticated` on the user's own row. The row is created at first
sign-in, not by a trigger. Linking an in-game player adds `player_links` and its siblings (below). Both
are additive and touch no object the overlay calls.

The server reaches Auth and the table with the publishable key plus the visitor's own token
(`src/server/auth/auth-gateway.ts`), so `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` must be set; the
service-role key (`SUPABASE_SERVICE_ROLE_KEY`) is used for one call only, deleting an account
(`DELETE /auth/v1/admin/users/<id>` from `POST /api/account/delete`), so Vercel needs it for Production. Dashboard settings the maintainer makes by hand:
Authentication, URL Configuration with the Site URL `https://rivalspulse.com` and Redirect URLs
`https://rivalspulse.com/**`, `http://localhost:4200/**` and `http://localhost:4000/**`; and Discord
enabled under Providers with the Discord application's client id and secret (its redirect is the
project's `/auth/v1/callback`). The session cookie is `Secure`: Chrome, Edge and Firefox accept it
on `http://localhost`, but Safari may not, so test local sign-in in one of those. `supabase/checks/profiles.sql` proves the RLS rules against the linked
project and rolls back: `npx supabase db query --linked -f supabase/checks/profiles.sql`.

### Linking an account to an in-game player (issue 264)

A player proves an in-game identity to their account with a one-time code. The link rests on the verified
Overwolf session, through the same `recorder_id` hash `track-match-history` stores as `recorded_by`; the uid,
name and avatar the app sends with the code request are claims and are only shown back to the owner.

- `issue-link-code` (Edge Function, `verify_jwt = false`, `x-overwolf-session` like `track-match-history`)
  verifies the session, takes `{ playerUid, playerName, avatarUrl }` from the body and calls
  `issue_link_code` (service role only). It answers `{ code: "XXXX-XXXX", expiresAt }`, 422 with
  `reason: "no-player"` when the app has no uid or name yet, 429 when the recorder has had five codes in an
  hour, and 401 or 503 from the session check. A code is 8 Crockford base32 characters (about 40 bits).
  `link_codes` keeps only its SHA-256 hash, one row per recorder (a new code replaces the old), valid for 10
  minutes, deleted when used. A hash collision between two recorders is retried.
- The website calls `redeem_link_code(p_code)` and `unlink_player()` through PostgREST with the player's own
  token (`src/server/auth/auth-gateway.ts`), so `auth.uid()` is the owner and no service key or `RECORDER_ID_SECRET` is
  needed there. `player_links` has `user_id` as its key and `recorder_id` unique, so an account has at most one
  link and a recorder at most one account. `player_uid` is not unique on purpose: a uid is a claim, and a unique
  one could be squatted. A fresh code redeemed by another account moves the link to it (latest proof wins).
- Wrong, used and expired codes are one answer. Five wrong codes in 15 minutes lock an account out for the rest of
  the window, even for a right code. The two windows (an hour for codes issued, 15 minutes for wrong codes) are
  written once each, as `link_issue_window()` and `link_lockout_window()`, and the limits and the purge all read
  them. `purge_link_data()` (service role only, scheduled every five minutes by a `purge-link-data` pg_cron job in
  the migration) deletes attempt rows past their window and codes that expired unused, so those are kept for
  their window plus up to five minutes; the issuing and redeeming functions
  also sweep their own kind, so retention does not depend on the scheduler. Wrong-code rows carry the account id with
  `on delete cascade`, so deleting the account deletes them. `redeem_link_code` refuses anonymous Supabase sessions.
- `avatar_url` is stored only when it is an `https` address on an Overwolf host (`OVERWOLF_AVATAR_DOMAINS` in
  `supabase/functions/_shared/player-claim.ts`, the one place to change it); the tables also refuse anything
  not starting `https://`. The real host has not been captured from a live overlay session yet, so the list is any
  host under `overwolf.com` until it is. The header and account page fall back to the player's initial.
- The overlay sends the request (issue `rivals_pulse` 1167): `POST` to `/functions/v1/issue-link-code` with the
  header `x-overwolf-session` and the body `{ "playerUid": "...", "playerName": "...", "avatarUrl": "..." }`.
- Not done here: attributing matches to the link (issue 266). Forgetting the *linked* uid must narrow to rows
  where `recorded_by` is the link's `recorder_id`.
- Deploy order: the migration by hand (`npx supabase db push`, before the pull request merges), then
  `npx supabase functions deploy issue-link-code`. The function needs `OVERWOLF_EXTENSION_ID`,
  `RECORDER_ID_SECRET`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`; the first two are already set for
  `track-match-history`. Until the migration is applied, the website reads "not linked" and the link route
  answers 503.
- `supabase/checks/player_links.sql` proves the rules against the linked project and rolls back:
  `npx supabase db query --linked -f supabase/checks/player_links.sql`. Run it after `db push`.

### Reading a linked player's own dashboard (issue 329)

`read_own_dashboard()` (`20261101060000_dashboard_read.sql`) is the only door to a player's own history. It
takes no parameters, runs as definer with an empty `search_path`, is granted to `authenticated` only, and
refuses a caller with no account (`28000`) and an anonymous Supabase session (`42501`), as `redeem_link_code`
does. It finds the caller's link through `auth.uid()` and returns the newest 2,000 `participants` lines where
`recorded_by = link.recorder_id AND uid = link.player_uid`, both taken from the link and never from the
caller, each with its `participant_hero_figures`. `participants` stays closed (RLS on, no grant), and no
service key is involved.

- The answer is `{ "linked": false }`, or `{ "linked": true, "name", "avatarUrl", "truncated", "lines": [...] }`
  newest first. A line has `playedAt`, `heroId`, `kills`, `deaths`, `assists`, `finalHits`, `isWin`,
  `playModeId`, `mapName` and `figures` (`heroId`, `seconds`, `damage`, `healing`, `blocked`). A blank is JSON
  `null`, never 0. `truncated` is true when more than 2,000 lines existed. The recorder and the uid are never in it.
- The website (`GET /api/account/dashboard`, `src/server/auth/auth-gateway.ts` `readOwnDashboard`) derives the figures from
  those lines in `src/server/account/own-dashboard.ts` and sends the browser only the derived stats.
- Which lines are the player's: a match is stored once, by its **first** uploader, so a match first uploaded by
  another overlay user in the same lobby is not here; lines from the backfill (`backfill-143`) carry no real
  recorder and never are; another recorder's line with the same uid is not (a uid is a claim); and
  `participants` is purged after at most six months, so that is the depth. `hero_id` is the hero at the end of
  the match (assumed, not yet confirmed from a real upload).
- Figures on `participant_hero_figures` are attached by `record_match_extras` to the line whose `uid` equals the
  uid its caller claims, without checking the line's recorder. A different recorder could therefore attach
  figures to a line it did not record; the read cannot tell, because it filters the line and not the figure.
  Closing that is a change to `record_match_extras`, which shipped overlays call.
- `tracked_matches` is not read: it has no recorder column and is publicly readable, so the recorder must never
  be added to it (issue 328 adds a side table). When that history is read, match on the side table's recorder
  and treat a row whose recorder changed as not the player's own.
- Before the read merges, resolve one open question with a read-only query after the first real link:
  `select count(*) from participants where uid = '<link.player_uid>' and recorded_by = '<link.recorder_id>'`
  must be above zero, or the link's `player_uid` does not match the uploads' uid format.
- `supabase/checks/dashboard.sql` proves the rules against the linked project and rolls back:
  `npx supabase db query --linked -f supabase/checks/dashboard.sql`. Run it after `db push`. The migration is
  pushed by hand before the pull request merges, after the player-links migration it depends on; until then the
  route answers 503.

### The app's own calls about its link (issues 320 and 343)

The desktop app calls these with `x-overwolf-session`. Each is an Edge Function with `verify_jwt = false`, all
built on `overwolfEndpoint` in `supabase/functions/_shared/overwolf-endpoint.ts` (CORS, method check, Overwolf
session check, the `recorder_id` hash, a plain 500 for anything unexpected). A function supplies only what it does
for the recorder; its logic sits in its own module (`refresh.ts`, `status.ts`, `unlink.ts`) so the Node tests run the whole request path
with a fake database, and `index.ts` is one line of wiring. An unverified session is answered 401 (503 when
Overwolf is down) before anything is read or written. The database side is a service-role-only SQL function per
action, never a broad table grant.

- `refresh-linked-player`: `POST` with `{ "playerName": "...", "avatarUrl": "..." }` (a `playerUid` is ignored).
  It calls `refresh_linked_player`, which sets `player_name` and `avatar_url` on the `player_links` row whose
  `recorder_id` is the verified session's, and nothing else: the uid, the account, the recorder and the link date
  never change, and no link is created. Answers `200 { "linked": true, "playerName": "..." }`,
  `200 { "linked": false }` when the session has no link (nothing written), `422 { "reason": "no-player" }` when
  there is no usable name, and `429` with a `Retry-After` header past 30 calls an hour per recorder. The name is
  cleaned and cut by the same rules as the link request. The avatar sent replaces the stored one; one that is not
  an `https` address on an allowed host is stored as none, so the page falls back to the player's initial.
- `link-status`: `GET` or `POST`, no body. It calls `link_status_for_recorder`, which reads `player_name` and
  `linked_at` of the recorder's link and no other column. Answers `200 { "linked": true, "playerName": "...",
  "linkedAt": "..." }` or `200 { "linked": false }`, and `429` past 60 calls an hour. It never returns the website
  account's email or id: the SQL does not select them and the function builds its answer from three named fields.
- `unlink-player-app`: `POST` or `DELETE`, no body (anything in one is ignored). It calls
  `unlink_player_for_recorder`, which deletes the `player_links` row of the verified recorder, keyed on
  `recorder_id` because the app has no website session (the website's `unlink_player()` is keyed on `auth.uid()`).
  Answers `200 { "linked": false, "unlinked": true }`, or `unlinked: false` when there was no link (unlinking is
  idempotent), and `429` past 10 calls an hour. Afterwards the website reads "not linked" for that account and the
  header shows "Account". The website account itself is untouched. A link code the recorder issued and has not yet
  used is deleted in the same call, so it cannot be typed afterwards. The website's `unlink_player()` deletes only the link.
- Rate limiting is `take_link_app_call(kind, recorder, limit)`, the same counting as `issue_link_code` over
  `link_issue_window()` with one `link_attempt_log` kind per function (`refresh`, `status`, `unlink`). A refused call is not logged. The purge
  ages out every kind except `redeem_failed` by the hour window, so a new kind needs no purge change.
- `supabase/checks/app_link_calls.sql` proves the rules against the linked project and rolls back:
  `npx supabase db query --linked -f supabase/checks/app_link_calls.sql`. Run it after `db push`.
- Deploy order: the migrations by hand, then `npx supabase functions deploy refresh-linked-player link-status
  unlink-player-app`. `issue-link-code` now runs on the same shared module, so redeploy it too. The secrets are the
  ones it already uses.

### Verified match history reads (issue 189)

`players`, `player_matches` and `tracked_matches` grant `select` to `anon` with `using (true)`, and the
publishable key ships inside the desktop app, so anyone holding it can list every uploader's name and match
history. Shipped overlays read their Match history and player details that way, so the grant cannot be dropped
until the overlays in use read through these two functions instead:

- `read-match-history`: `POST` with `{ "after": "<ISO time>" }` or no body. It calls `read_own_tracked_matches`,
  which returns the matches whose `tracked_match_recorders.recorded_by` is the verified session's recorder,
  newest written first, at most 500, only those written after `after` when given. Answers
  `200 { "matches": [{ matchUid, playedAt, recordedAt, rawPayload, performance }] }`, `400` for an `after` that
  is not a time, and `429` past 120 calls an hour. A name in the body is ignored: the recorder alone decides
  whose history is read. Matches uploaded before the recorder table existed (issue 328) are returned only once
  `backfill_tracked_match_recorders` has tied them to a recorder (see "Older uploads" below).
- `read-player-scoreboard`: `POST` with `{ "playerUid": "..." }`. It calls `read_player_scoreboard_lines`, which
  returns that player's kills, deaths and assists per match, from the uploader's own line and from any upload's
  scoreboard listing the uid (as text, or as the same safe integer an older upload stored), at most 500, newest
  played first. Answers `200 { "lines": [{ matchUid, kills, deaths, assists }], "limited": bool }`, `400` for a
  missing uid, and `429` past 240 calls an hour. No name, uploader or other player's line leaves.
- `supabase/checks/verified_match_history_reads.sql` proves the rules against the linked project and rolls back.
  Run it after `db push`.
- Deploy order: the migration by hand, then `npx supabase functions deploy read-match-history
  read-player-scoreboard`. The secrets are the ones `link-status` already uses.
- Dropping the `anon` select is a separate, later migration, taken once the overlays in use call these functions.

**Older uploads (issue 697).** An upload from before `tracked_match_recorders` existed stored no recorder, and its
scoreboard lines carry no recorder code either (only uid, nick_name, camp, hero, kills, deaths and assists), so nothing
on the row names the uploader. The one evidence left is the player it was filed under. `20261109100000_backfill_tracked_match_recorders.sql`
creates `backfill_tracked_match_recorders()` (service role only, adds rows only, returns the count) and runs it once.
It ties an untied match to a recorder when every match already recorded under that player names the same one recorder
and the match's own `player_uid`, if it has one, is a uid those recorded matches carry. A player whose recorded matches
name two recorders, or none, stays untied. A name is the app's claim, so this is the best evidence and not proof; it
can only give a match to the recorder already holding every other match filed under that name, and those matches were
already readable through the `anon` select. Production on 2026-11-09: 878 matches, 199 with a recorder, 679 without;
the rule ties 670 of the 679 (one recorder in all), and the other 9 belong to players with no recorded match and
stay untied. The function can be run again to tie a match whose recorder write failed
(`npx supabase db query --linked "select public.backfill_tracked_match_recorders()"`). Prove the rule with
`npx supabase db query --linked -f supabase/checks/backfill_tracked_match_recorders.sql` after `db push`.

### The site administrator role (issue 290)

[ADR-0005](decisions/0005-gate-site-administration-behind-an-admin-table.md) is the design. `20261104140000_admins.sql` adds
`public.admins` (`user_id` references `auth.users` on delete cascade, `granted_at`, `note`) with RLS on, no policy and no grant to
`anon`, `authenticated` or `service_role`, and `public.is_admin()`: security definer, empty `search_path`, executable by `authenticated` only,
true when `auth.uid()` has a row. Nothing in the website writes the table, and nothing is kept in the sign-in token, so
**revoking takes effect on the admin's next request**: the API refuses at once, and the Admin link goes at the next page load.
The service-role key is not used for any admin read or write.

- The website asks `is_admin()` with the visitor's own token (`AuthGateway.isAdmin`), on `GET /api/auth/session` (the
  `isAdmin` field, which only decides whether the header shows the Admin link) and in front of every `/api/admin/*` route
  (401 signed out, 403 not an admin, 503 when the database cannot say). Until the migration is applied the function is
  missing, so the session reads `isAdmin: false` and the admin routes answer 503; nothing else is affected.
- **Release order for the migration** (it has never run anywhere, so it follows "Migrations" above, not the merge deploy alone):
  `npx supabase migration list --linked` (the local and remote columns must match), `npx supabase db push` from the branch,
  `npx supabase db query --linked -f supabase/checks/admins.sql`, then merge soon after (a migration pushed and left unmerged makes
  the integration refuse every deploy), then grant admin by hand and walk the checks below. The maintainer approves the push.
- The admin area works on `rivalspulse.com` and from `localhost` against the live project, as sign-in does. A preview
  deployment has no sign-in, so none.

**Granting and revoking admin is the owner's, by hand, outside the website.** There is no sign-up route to it. With the CLI
linked to the project (see "Migrations"), after the account has signed in once:

```sh
# 1. Find the account's id (read-only). Match on the sign-in you made, then check the created date is right.
npx supabase db query --linked "select id, email, created_at from auth.users where email = '<the account email>'"

# 2. Grant admin. Safe to repeat.
npx supabase db query --linked "insert into public.admins (user_id, note) values ('<id from step 1>', 'site owner') on conflict (user_id) do nothing"

# See who is an admin.
npx supabase db query --linked "select user_id, granted_at, note from public.admins"

# Revoke admin. The account keeps its sign-in.
npx supabase db query --linked "delete from public.admins where user_id = '<id>'"
```

Grant by the id from step 1, never by an email typed into the insert: an address is something Discord reports, not something this site verified. Deleting the account deletes its row.

**Checks after the migration is applied.** CI starts no database (real database tests are a separate chore), so `scripts/admin-migrations.test.ts` (part of
`npm run test:functions`) reads every migration for the rules, and these show them against the real project:

- `npx supabase db query --linked -f supabase/checks/admins.sql` proves the rules in a transaction it rolls back, with two
  throwaway users and no real account: a row makes an administrator, a signed-in account without one is not, `anon` cannot
  call the function, neither role can read or write the table, revoking is seen on the next call and deleting the account
  deletes the row.
- By hand, once an admin is granted: signed out, `/api/admin/me` answers 401; signed in with an account that is not an admin,
  403; signed in as the admin, 200 `{"admin":true}`; the header shows Admin for the admin only; `/admin` sends everyone else to
  the home page. Then revoke, reload, and confirm the same account now gets 403 and no Admin link, and grant again.

Adding an admin page or route: a page is one entry in `ADMIN_PAGES` (`src/app/features/admin/admin-pages.ts`); an API route
is one entry in `ADMIN_ROUTES` (`src/server/admin/admin-routes.ts`) plus a two-line file under `api/admin/`. A database
function it calls must be security definer (an internal helper that no API role can call needs only an empty `search_path`), call `public.is_admin()` before it touches anything and be granted to
`authenticated` only. The static test enforces this for every migration from `20261104140000` on: any function a signed-in
account can call (granted to `authenticated`, or not revoked from it, since Supabase grants new functions by default) must call
`is_admin()` or be listed in `NOT_ADMIN_FUNCTIONS` (`scripts/admin-migration-rules.ts`), which is a decision for review.
It also fails a later grant, policy or `disable row level security` on `public.admins`, and any table with `admin` in its name
without RLS.

### Running the data jobs on demand (issue 494)

The admin page "Data jobs" (`/admin/data-jobs`) runs the six background jobs sooner than their schedule: the five hourly
rebuilds (`recompute-hero-aggregates`, `recompute-extended-aggregates`, `recompute-community-match-aggregates`,
`recompute-play-time-aggregates`, `recompute-hero-pair-aggregates`, each named by its `pg_cron` job) and the home news sync the
website runs on Vercel (`home-news`). Player uploads cannot be forced, and the page says so. The list is in
`src/contracts/admin-data-jobs.model.ts` and again in `data_job_cooldown()` (the allow-list: null for any other key);
`scripts/admin-data-jobs.test.ts` fails when the two disagree or when a rebuild is not the function its cron job runs.
`20261104150000_admin_data_jobs.sql` is the design:

1. **`admin_begin_run(job)`** checks `is_admin()`, the allow-list, whether the job's latest run is open (started less than ten minutes
   ago and not closed) and its cooldown (one minute; ten for `home-news`, counted from the start of the last run), under an advisory
   lock so two clicks start one run. It answers `busy` with `reason` and `retryAt` and writes nothing, or writes the `admin_audit_log`
   row (`actor_id`, `job`, `started_at`, outcome `running`) and returns its id. It is a call of its own, so the row is committed
   before any work starts and a timeout cannot erase it.
2. A rebuild is **`admin_run_rebuild(run_id)`**, for the administrator who began that open run: it runs the job's `recompute_*`
   function (the one its cron job runs) and closes the row as `succeeded` in the same transaction. If the rebuild fails or the role's
   `statement_timeout` (8 seconds for `authenticated`) stops it, that transaction rolls back and the row stays open. A sync is run
   by the web server (`src/server/admin/sync-jobs.ts`), because only the server can reach the official site.
3. **`admin_finish_run(run_id, outcome, detail)`** closes the administrator's own open row as `succeeded` or `failed`. The web server
   calls it after a sync, and after a rebuild that threw. A row nobody closes reads as `unfinished` ("did not finish") once it is over
   ten minutes old and no longer blocks the job.
4. **`admin_data_jobs_status()`** gives each job's last scheduled run (a rebuild's from `cron.job_run_details`, a sync's from
   `sync_runs` where `by_admin` is false), its last manual run (from the audit log) and any wait. A history it cannot read reads as none.

The service-role key is used for the sync only, inside `runHomeNewsJob`, after step 1 has succeeded
(ADR-0005 decision 6, amended). `CRON_SECRET` is not read by the admin area. Scheduled runs are untouched: they leave
`sync_runs.by_admin` at its default, and a manual sync passes `byAdmin` so the page can tell the two apart.

**What a news run really did.** A read has one 30-second deadline for every page it fetches, so a slow site fails the run before anything is
saved and the earlier news stays. A page that answers but holds no news card also fails the run before anything is saved (the scheduled
run too), instead of replacing the news with a placeholder.

**Not done here:** a function-level `statement_timeout` for a rebuild that outgrows 8 seconds (the slowest took about 1.08 seconds on
2026-11-04; whether PostgREST honours it is unverified, and `SET` in a function does not reliably cut off the statement that called it),
and a `pg_cron` queue for one that passes about 60 seconds. Either is a follow-up when a rebuild gets near the limit.

- **Release order for the migration** (it has never run anywhere, so it follows "Migrations" above, not the merge deploy alone):
  `npx supabase migration list --linked` (the local and remote columns must match), `npx supabase db push` from the branch,
  `npx supabase db query --linked -f supabase/checks/admin_data_jobs.sql`, then merge soon after (a migration pushed and left
  unmerged makes the integration refuse every deploy). The Vercel deploy needs nothing else: the website and its secrets are
  unchanged. Until the migration is applied the page answers 503 and nothing else is affected. The maintainer approves the push.
  The check holds locks until it rolls back, so a scheduled rebuild can wait a few seconds behind it: do not run it in minutes :07,
  :13, :17, :37 or :43.
- **Next scheduled run:** the page counts down from the `schedule` of each job in `src/contracts/admin-data-jobs.model.ts`, not from the
  scheduler. `scripts/data-job-schedules.test.ts` fails if a migration, `vercel.json` or a workflow file says otherwise, so change them together.
- `supabase/checks/admin_data_jobs.sql` proves the rules in a transaction it rolls back, with three throwaway users and throwaway
  half-seasons (998.0 and 999.0, and 97.0 and 98.0 for play time, which reads tracked matches that name their own half-season):
  only an administrator can use any of the four functions (a stranger, `anon` and the service role cannot); a key outside the
  allow-list starts nothing; the audit row exists before the rebuild and survives a rolled-back one; a second click and a click inside
  the cooldown write nothing; for all five rebuilds a manual run updates `computed_at` on an unfinished half-season and leaves a
  frozen one's `computed_at` and `frozen_at` alone, and no real frozen half-season changed; only the administrator who began a run can
  run or close it; a run over ten minutes old reads as unfinished; a pg_cron history row with no start time is left out; a rebuild's
  scheduled run is shown when pg_cron has one; and deleting an account keeps its audit rows. **Judge it by its exit status.** Every
  failure is an exception (`check failed: ...`) that stops the script with a non-zero exit; the notices are for reading, and the last
  ("all admin data job checks passed") is reached only when nothing raised. Whether `supabase db query` shows the notices has not been
  confirmed, so do not treat their absence or presence as the result.
- By hand, once the migration is applied and an admin is granted: open `/admin/data-jobs` at desktop and phone width; run Hero stats
  and see "Rebuilt N half-seasons" and a new "Last manual run"; click it again at once and see it refused with a time; run Home news. The check's second click shares its transaction with
  the first, so it does not prove two simultaneous requests: send two at once by hand (two tabs, or two `curl` calls with the
  session cookie) and see that one starts and the other gets 409.
- **What "during a run" means.** The cooldown and the open-run check look at the audit log, so they cover manual runs only. A click
  while the *scheduled* run of the same job is going is not refused: a rebuild waits on its advisory lock and then rebuilds again
  (harmless), and a home news run is last-writer-wins.
- The route that runs jobs has `maxDuration: 60` in `vercel.json` (`functions`), above the 30-second news deadline and within the
  limit every plan allows, so it does not depend on the project default. `scripts/admin-routes.test.ts` holds it.

### Pulse Records read (issue 566)

[ADR-0006](decisions/0006-publish-opted-in-player-names-on-pulse-records.md) is the design. `read_pulse_records()`
(`20261107100100_pulse_records_read.sql`) is the only door to the boards: security definer, empty `search_path`,
no parameters, executable by `service_role` only. It returns `{ coveredFrom, categories: [{ key, rows: [{ heroId,
value, name }] }] }` for `kills`, `assists`, `final_hits`, `damage`, `healing` and `blocked`, up to 50 rows each, and
never a uid, recorder, line id or match time. The website reads it through `GET /api/records`
(`src/server/records/`, `api/records.ts`, one Express route), which sends `public, max-age=0, s-maxage=60` and no
stale window, so a name is gone within two minutes of its owner switching naming off
(`scripts/pulse-records-route.test.ts`). The Pulse Records tab of the Stats hub (`/stats/records`, with `?category=`) reads it through that route and show a board only from 2 rows. The read keeps one row per uploader per board (`per_uploader`), so 2 rows are 2 distinct uploaders; changing that step changes what the gate means.

A line counts only if it passes every guard, all in the `lines` step:

- Quick Match or Competitive (`play_mode_id` 0 or 1) and a real hero. Not on `records_hidden`, not in `do_not_store`.
- **Named** only when `recorded_by = player_links.recorder_id` AND `uid = player_links.player_uid` AND that account's
  `account_settings.show_in_records` is true. The name is the link's `player_name` with control and bidirectional
  characters removed, never `participants.name`. A linked player with naming off is left off, and so is one whose link
  name is empty once cleaned: a linked line is named or absent, never anonymous. A `do_not_store` name also matches the
  link's name. `coveredFrom` is the oldest line the boards can draw on.
- **Left off entirely:** any line whose uid is linked to an account but was uploaded by someone else, opted in or not.
  So the anonymous rows are only lines whose uid no account has linked.
- Damage, healing and blocked come from `participant_hero_figures` of a named line only (seconds above 0, a value
  within its ceiling, a per-minute rate within its ceiling), so those boards never hold an anonymous row. Per hero,
  not per match.
- One row per player (linked account, else uid, else lower-cased name), then one row per uploader; the earlier match
  wins a tie. With few uploaders a board is short by design: two uploaders can fill at most two rows.

Ceilings (restate `pulse_records_value_cap` and `pulse_records_rate_cap` in a new migration to change them; nothing
needs rebuilding). Chosen on 2026-11-07 from production (8,202 lines, 191 figure rows, 2 uploaders), Quick Match and
Competitive: the largest kills, assists and final hits seen were 66, 59 and 35, so 100, 100 and 60. The largest
damage and blocked segments were 25,308 and 41,539 (3,254 and 6,875 per minute), so 40,000 and 65,000 with 5,000 and
10,000 per minute. Healing has no support rows to learn from (largest 1,243), so 80,000 and 6,000 per minute come from
what the game allows; revisit once supports upload. Ceilings only limit a forger, they do not stop one: a forged
value just under a ceiling can still top a board, and a modified client can claim a real player's name when linking.

- **Hide a line by hand** (the only moderation): `npx supabase db query --linked "insert into public.records_hidden
  (participant_id, note) values (<participants.id>, '<why>')"`. The entry goes when the line is purged.
- **Cost:** about 155 to 190 ms on 8,202 lines, mostly the sort. If it passes a few seconds, fall back to a candidates
  table that holds only `participants.id` with cascade delete and no names.
- **Release order:** the migrations are not applied by merging. Push by hand before the merge
  (`npx supabase migration list --linked`, then `npx supabase db push`), then
  `npx supabase db query --linked -f supabase/checks/pulse_records.sql`, which plants lines and rolls back and is judged
  by its exit status. Until applied, `/api/records` answers 200 with `status: "not-enough-data"`.
- Known gap: `record_match_extras` attaches figures by the claimed uid without checking the uploader, so another
  uploader can put figures beside an opted-in name. Accepted for v1 (ADR-0006); issue 352 tracks it.

### The "Show me in Pulse Records" switch (issue 568)

`set_records_opt_in(p_show boolean)` (`20261107130000_records_opt_in.sql`) is the only way the setting changes: security
definer, empty `search_path`, executable by `authenticated` only (not `anon`, not `service_role`). It acts on `auth.uid()`
and takes no account id. It returns `{ "status": "saved", "showInRecords": bool }`, or `{ "status": "not_linked" }` when
asked to turn it on with no link (nothing is written); turning it off always works. The table has no trigger of its own, so
the function sets `updated_at`. It holds the account's `player_links` row (`for share`) while it writes, so an unlink or
relink racing it waits and then switches the setting off.

- **The setting goes off when the link goes.** An `after delete` trigger on `player_links`
  (`reset_records_opt_in()`, closed to every API role) sets `show_in_records = false` and `updated_at` for the account
  whose row was deleted. Every way a link ends deletes that row (`unlink_player`, `unlink_player_for_recorder`, the
  "latest proof wins" delete in `redeem_link_code` when the account moves to another player or another account takes the
  recorder, and the cascade from deleting the account), so the three functions are not restated and a later one is covered.
  Linking the same player again also switches it off. A first link starts off.
- **Reading it.** The website reads the owner's own row with `GET /rest/v1/account_settings?select=show_in_records` and the
  account's own token (the existing select policy). A read that fails is a 503, never "off", so the page cannot claim a name is
  hidden when it may not be. The routes are `GET` and `POST /api/account/records-opt-in` (see
  [api-specification.md](api-specification.md)).
- **Checks.** `npx supabase db query --linked -f supabase/checks/records_opt_in.sql` plants accounts and links, asserts the
  owner-only rules (another account reads no row and writes none, `anon` and `service_role` cannot call the function, no
  client writes the table), the not-linked refusal, `updated_at`, and the reset on website unlink, app unlink, relink over a
  live link, losing a link to another account and deleting the account, and rolls back. Judge it by its exit status.
- **A rename keeps the switch on.** `refresh_linked_player` updates the link's name and avatar in place, so the trigger does
  not fire and the setting stays on: it is the same recorder and the same player, only the name the app reports changed
  (ADR-0006 ties naming to the link, not to the name). The new name is what the boards show.
- **Release order.** Push `20261107130000` by hand (`npx supabase db push`) before the pull request merges; the two
  Pulse Records migrations before it are already applied. It was applied to production on 2026-11-08. The maintainer
  decided on 2026-11-08 that the switch ships before `anthonyturner/rivals_pulse#1386` (the desktop app privacy
  policy), which follows; the website's `/privacy` section is the notice until then (ADR-0006, amended).

## The media defaults

A signed-in account chooses two defaults on the account page (issue 705): whether hero pages open on the gameplay video, and
whether the gameplay video and the home pulse banner start with sound. One sound default serves both places, by the maintainer's
decision of 2026-11-09. They are two more columns on `account_settings` (`hero_video_default`, `sound_default`, both
`boolean not null default false`), so they follow the pattern of the Pulse Records switch: the owner can select their own row, no
client writes the table, and an account with no row reads as both off.

- **Writing it.** `set_media_defaults(p_hero_video boolean default null, p_sound boolean default null)` is `security definer`, empty
  `search_path`, granted to `authenticated` only (`public`, `anon` and `service_role` are revoked), and takes no account id: it acts on
  `auth.uid()`. A null parameter means "leave that one", so the two controls save independently; both null is refused (22004) and a caller
  with no account is refused (28000). It upserts the row, sets `updated_at` itself (the table has no trigger), and returns
  `{"status":"saved","heroVideo":bool,"sound":bool}` with both stored values. It does not touch `show_in_records`, and unlinking the player
  does not reset these (they belong to the account, not to the link).
- **Reading it.** The website reads the owner's own row with `GET /rest/v1/account_settings?select=hero_video_default,sound_default` and the
  account's own token while it answers `GET /api/auth/session`, so every page knows the defaults without a second request. A read that
  fails is `null` in the session, which pages treat as a signed-out visitor: unlike the Pulse Records switch, a wrong "off" here only
  leaves a page as it is today. The routes are `POST /api/account/media-defaults` and the session answer (see
  [api-specification.md](api-specification.md)).
- **In the browser.** Signed in, the saved default is what a page opens with; the banner and video toggles change it for that visit
  only and write nothing, and the saved default returns on the next visit (`accountDefaultedSetting`). Signed out, or when the defaults
  could not be read, the browser-remembered toggles work as before. `prefers-reduced-motion` stops a saved "video on" from starting by
  itself. A saved "sound on" is applied to the hero video only once the player reports ready and the browser reports the visitor has
  interacted with the page (`navigator.userActivation.hasBeenActive`); until then the video stays muted and its Sound button shows off.
- **Checks.** `npx supabase db query --linked -f supabase/checks/media_defaults.sql` plants accounts and asserts the defaults are off, each
  saves alone and sets `updated_at`, only the owner reads or changes their row, no client writes the table, the Pulse Records switch is
  untouched, an empty choice and a caller with no account are refused, and `anon` and `service_role` cannot call the function; it rolls back.
  Judge it by its exit status.
- **Release order.** Push `20261109120000` by hand (`npx supabase db push`) before the pull request merges (see the opening of this file).

## Tests

`npm run test:functions` runs the function tests with Node's built-in test
runner (Node 24, which strips TypeScript types itself). The `ci.yml`
job `Supabase function tests` runs it on every pull request.
