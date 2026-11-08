# Turso Content Database

> The hero tables (`heroes`, `hero_list_items`, `hero_abilities`) moved to Supabase in issue 105 and
> the hero syncs now write `sync_runs` and `external_sources` there. See
> [supabase.md](supabase.md#website-hero-data). The home tables (`home_portals`,
> `home_content_blocks`) and the home news sync followed in issue 107; see
> [supabase.md](supabase.md#website-home-content). The Turso copies are frozen and are dropped
> with Turso (issue 110). `hero_videos`, `glossary_terms` and `external_sources` followed in issue
> 106 ([supabase.md](supabase.md#website-reference-content)), and the game stat tables in issue 109
> ([supabase.md](supabase.md#website-game-stats)).
>
> The anonymous hero counts that outlive the purge (hero pairs against and with each other, among them) are
> Supabase tables too: see [supabase.md](supabase.md#hero-pair-aggregates). So are the triple-support
> trio counts and the role of each game hero id they depend on: see
> [Triple-support aggregates](#triple-support-aggregates-supabase) below.

The app uses one shared Turso/libSQL database for curated content and cached external API payloads.
The mock JSON files under `data/seeds` are seed inputs only; runtime pages read from the Express API backed by Turso.

## Connection

- Database URL: `TURSO_DATABASE_URL`
- Database token: `TURSO_AUTH_TOKEN`
- Schema: `scripts/sqlite-schema.sql`
- Seed script: `scripts/seed-sqlite.mjs`
- External sync script: `scripts/sync-external-sources.mjs` (writes Supabase)
- Hero wiki sync script: `scripts/sync-heroes.mjs` (writes Supabase)

Credentials are stored in `.env` locally and in Vercel environment variables for production.

Rebuild seeded content with:

```bash
npm run db:seed
```

Refresh seeded data and external source payloads with:

```bash
npm run content:update
```

Discover new Fandom heroes and upsert hero profile data with:

```bash
npm run sync:heroes
```

## Tables

### `heroes` (now `hero_content` in Supabase)

Stores one row per hero and keeps the complete source object in `raw_json` so the current Angular data model can be served without losing nested fields.

### `hero_list_items` (now in Supabase)

Stores repeated hero values:

- `strength`
- `weakness`
- `counter`
- `synergy`

### `hero_abilities` (now in Supabase)

Stores hero abilities. Default abilities use empty `kit_role` and `kit_label`; role-specific kits, such as Deadpool's Vanguard/Duelist/Strategist pools, set those fields.

### `hero_videos` (now in Supabase)

Stores hero-specific and role-fallback YouTube video mappings used by the Heroes page.
PAZ gameplay and counters/combos videos are seeded here so the page does not carry those mappings in component code.

### `home_portals` (now in Supabase)

Stores the home page portal cards.

### `home_content_blocks` (now in Supabase)

Stores the remaining home page content blocks by key, including stats, news cards, featured guides, quick links, and current focus copy. In Supabase the `payload_json` text column is `payload jsonb`.

### `glossary_terms` (now in Supabase)

Stores the glossary content and keeps the full source object in `raw_json`.

### `external_sources` (now in Supabase)

Stores cached payloads from external APIs such as Fandom. This lets the app read stable database-backed data while still giving us a refresh path.

### `sync_runs`

Stores update history for external sync jobs.

### `game_stat_snapshots` (now in Supabase)

Stores one game-stat capture header per UTC hour. The unique `capture_bucket` prevents page traffic and cron retries from creating duplicate hourly snapshots.

### `game_stat_snapshot_games` (now in Supabase)

Stores the per-game values for each snapshot, including current players, 24-hour peak, all-time peak, daily rank, seller rank, review text, and source URL. The Game Stats API joins the latest incoming values with the preceding snapshot to calculate historical deltas.

## Triple-support aggregates (Supabase)

Counts of the teams that ran exactly three Strategists, written by a database job from `participants`
and kept after the raw rows are purged. Full rules: [supabase.md](supabase.md#triple-support-aggregates).
RLS is on with no policy; only the service role reads the tables, and the site reads `read_triple_support_trios`.

| Table | Holds |
| --- | --- |
| `hero_game_roles` | One row per game hero id: `game_id` (key), `base_game_id` (the hero's own id; Deadpool's three role forms 10571 to 10573 share 1057) and `role` (Vanguard, Duelist or Strategist). Deadpool's role-less base id 1057 and hero id 0 have no row. Seeded by the migration; a new hero needs a row. |
| `triple_support_trios` | Key: `half_season`, `play_mode_id`, `rank_bucket` (-1 = unknown), and the trio `hero_a <= hero_b <= hero_c` (base game ids). Counts: `matches` (distinct matches), `teams` (team occurrences, so a match where both teams ran it adds two) and `wins`. Only trios with 10 or more matches over the half-season are stored. |
| `triple_support_totals` | Key: `half_season`, `play_mode_id`, `rank_bucket`. `matches`, `decided_matches`, `recorders` and `top_recorder_matches` (numbers only, for the recorder gate) and the team counts of matches with a result: `classified_teams` (every hero's role known: a trio's denominator), `unclassified_teams` (a hero with no role: id 0, 1057, an unknown id) and `four_plus_teams` (classified, four or more Strategists, counted as a shape only). |
| `triple_support_aggregate_half_seasons` | Which half-seasons were built, when, and when frozen by the purge. |

No table holds a uid, name, fingerprint or recorder. `hero_id` in `participants` is the hero each
player ended the match on, so a trio is the heroes the team finished on.

## API Routes

The Express SSR server exposes read-only routes:

- `GET /api/content/status`
- `GET /api/heroes`
- `GET /api/hero-videos`
- `GET /api/home/content`
- `GET /api/home/portals`
- `GET /api/glossary`
- `GET /api/external-sources/:sourceKey`
- `GET /api/game-stats`
- `GET /api/triple-support-trios`
- `GET /api/sync/game-stats` (cron or authorized manual sync)

## Update Flow

1. Update curated JSON files or generator scripts.
2. Run `npm run db:seed` to load the seeded content into Supabase (home page tables, glossary terms
   and hero videos; heroes are not seeded) and apply the Turso schema.
3. Run `npm run db:sync` to refresh external source payloads.
4. Run `npm run sync:heroes` to discover and upsert current Fandom heroes.
5. Run `npm run build` to verify the app still compiles.

`npm run content:update` runs steps 2 through 4.

## Hero Sync Notes

The hero sync script:

- Reads `Category:Heroes` from Fandom.
- Fetches each hero page's wikitext.
- Skips pages that do not expose a valid hero role.
- Parses role, difficulty, official summary, strengths, weaknesses, synergies, and a compact ability list.
- Inserts new heroes into Supabase.
- Updates existing heroes in Supabase.
- Preserves curated fields that are hard to reconstruct automatically, such as Deadpool's role-specific ability kits and existing local image paths.
- Preserves existing counter arrays and gives a brand-new hero broad role-based fallback counters. The website no longer shows either: counters come from recorded matchups (`/api/hero-matchups`), so these arrays are unused data awaiting removal.

New heroes without a local portrait use `/images/heroes/default-hero.png` until an image is added.
