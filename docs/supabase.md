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

- **Required:** `select jobname from cron.job where jobname =
  'purge-expired-participants';` must show the daily job. If it does not (the
  migration warns when `pg_cron` is unavailable), enable `pg_cron` and schedule
  `select public.purge_expired_participants();` daily by hand.
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
runner (Node 22.18 or newer, which strips TypeScript types itself). The `ci.yml`
job `Supabase function tests` runs it on every pull request.
