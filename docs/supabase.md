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
  `sync-match-history`, `sync-hero-stats`, `marvel-rivals-proxy`. All keep
  `verify_jwt = false`
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

| Function | Deployed from this repo | Live version |
| --- | --- | --- |
| `track-match-history` | yes, 2026-10-27 | 16 |
| `elevenlabs-agent-token` | yes, 2026-10-27 | 8 |
| `sync-match-history` | yes, 2026-10-27; not used by the release overlay | 26 |
| `sync-hero-stats` | yes, 2026-10-27; not used by the release overlay | 23 |
| `marvel-rivals-proxy` | yes, 2026-10-27; adopted from the overlay branch `fix/381-api-key-server-side`, source unchanged | 9 |

The version number goes up by two on each deploy, so compare the number with
`npx supabase functions list` only to see whether a deploy happened, not to
count deploys. Anything deployed after the date above may have changed the
live function without changing this table.

`marvel-rivals-proxy` forwards a fixed list of read-only calls to the Marvel
Rivals provider and adds the provider key (`MARVEL_RIVALS_API_KEY`) on the
server, so the key no longer ships inside the overlay bundle. It was adopted
into this repo rather than removed because the overlay depends on it. It has no
caller check of its own: it spends the provider quota for anyone who finds its
URL, limited only by the allow-list in `routes.ts`.

Without Docker the CLI cannot bundle a function itself, so deploy through the
API:

```sh
npx supabase functions deploy track-match-history --use-api
npx supabase functions deploy elevenlabs-agent-token --use-api
```

`supabase/config.toml` carries `verify_jwt = false` for each function; if a
deploy ever reports a different setting, pass `--no-verify-jwt`.

## Secrets

Set with `npx supabase secrets set NAME=value`. Names only here.

| Secret | Used by | Note |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | all | Supplied by Supabase itself |
| `OVERWOLF_EXTENSION_ID` | `track-match-history`, `elevenlabs-agent-token` | The overlay's Overwolf extension id (the long id in its `overwolf-extension://<id>/` window URLs). A packed store build and an unpacked dev build differ. It is passed to Overwolf's verify endpoint as given, so any id Overwolf accepts works. Set on 2026-10-27 to the id of the maintainer's unpacked developer build, the only client today. **When the overlay is published, set it to the store build's id first**, or every upload from the store build is refused. |
| `RECORDER_ID_SECRET` | `track-match-history` | Random 32+ bytes (`openssl rand -hex 32`). Keys the hash that replaces the Overwolf username. Changing it resets everyone's rate-limit history and nothing else. |
| `ELEVENLABS_MAIN_API_KEY`, `ELEVENLABS_AGENT_ID` | `elevenlabs-agent-token` | See that function's header |
| `TEBEX_STORE_PUBLIC_TOKEN` | `elevenlabs-agent-token` | The Tebex store's public token. The premium gate switch, which also needs `OVERWOLF_EXTENSION_ID` on this function: unset or empty and the function mints tokens for anyone; set and every caller needs a verified Overwolf session and a paid plan (401, 403 `premium-required`, 503 when Overwolf is down). |
| `MARVEL_RIVALS_API_KEY`, `MARVEL_RIVALS_API_BASE_URL` | `marvel-rivals-proxy`, `sync-hero-stats`, `sync-match-history` | The provider key, which the proxy adds to each forwarded call. The base URL is optional (the proxy defaults to the provider's own and trims a trailing `/v1`). |
| `HERO_STATS_SYNC_COOLDOWN_SECONDS`, `MATCH_HISTORY_SYNC_COOLDOWN_SECONDS` | `sync-hero-stats`, `sync-match-history` | Optional. Seconds before the same player can be synced again. |
| `PREMIUM_JARVIS_PACKAGE_IDS` | `elevenlabs-agent-token` | Optional comma-separated Tebex package ids that count as premium. Unset means any package of the store; set to something with no valid id, the gate refuses everyone (500). |

Deploy order for `track-match-history`: migration, then secrets, then
function. A function deployed first fails closed (every upload is refused).

## Rollout order and rollback

The first deploy from this repo was done on 2026-10-27 in this order, which is
also the order to repeat for any change that adds a secret:

1. Migrations (already all applied; `migration list --linked` showed no gap).
2. Secrets: `OVERWOLF_EXTENSION_ID` and `RECORDER_ID_SECRET`. The second is a
   fresh random 32-byte hex value generated for the purpose and never written
   down. `TEBEX_STORE_PUBLIC_TOKEN` stays unset, so premium is dormant.
3. Functions: `track-match-history`, `elevenlabs-agent-token`,
   `sync-match-history`, `sync-hero-stats`, `marvel-rivals-proxy`.

Which overlay build expects it: `track-match-history` now refuses an upload
that has no verified Overwolf session in the `x-overwolf-session` header. The
overlay has sent that header since 2026-10-10 (overlay issue 760), so any build
from that date on works; an older build is refused with a 401.

To roll back:

- A function: check out the earlier commit of this repo and deploy that
  function again. The version from before this repo owned the source (for
  `track-match-history`, the build with no Overwolf check) is in the overlay
  repo's history, and the live source can be read with `npx supabase functions
  download <name> --use-api` into a folder outside the repo.
- A secret: removing `OVERWOLF_EXTENSION_ID` or `RECORDER_ID_SECRET` makes
  `track-match-history` refuse every upload, which is a stop switch, not a
  rollback. Replacing `RECORDER_ID_SECRET` costs only the rate-limit history.

## Is the live project in step with the repo

`supabase db diff --linked` is the strict check and needs Docker, which the
maintainer's machine lacks, so it has not been run. What stands in for it:
`migration list --linked` (all eight local migrations are also remote, same
versions), the read-only queries in the migration notes above, and
`functions download --use-api`, which for `marvel-rivals-proxy` returned source
identical to the repo copy apart from line endings.

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

  Run against the live project on 2026-10-27 after the deploy: both returned
  the documented 401. A well-formed, unexpired but unsigned token also returned
  401 "Overwolf rejected the session token", which shows the secrets are read
  and Overwolf is reached. A preflight (OPTIONS) request returned 200 and
  allowed the `x-overwolf-session` header. `elevenlabs-agent-token` answered
  405 to a GET, `sync-hero-stats` and `sync-match-history` answered 400
  "query is required" to an empty body, and `marvel-rivals-proxy` answered 405
  to a POST and 404 to an unlisted path. Not run: an upload with a real token
  (it writes rows), and a Jarvis token request (it mints a real token).
  A forwarded read through `marvel-rivals-proxy` also could not be confirmed,
  because the provider's own site was returning a Cloudflare 502 at the time.

- With a real token (from a signed-in overlay, valid 15 minutes), one upload
  returns `{"status":"ok","recorded":1,"participants":N}` and a repeat of the
  same match returns `participants: 0`.
- Deleting a player who asked: `select public.forget_player('<uid>', '<in-game
  name>');` deletes their rows and stops any later upload from storing them
  again. Either argument may be null.

## Tests

`npm run test:functions` runs the function tests with Node's built-in test
runner (Node 22.18 or newer, which strips TypeScript types itself). The `ci.yml`
job `Supabase function tests` runs it on every pull request.
