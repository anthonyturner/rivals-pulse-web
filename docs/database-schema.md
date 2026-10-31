# Content Database

The website keeps all of its content in Supabase (hosted Postgres), the same project the Rivals
Pulse overlay uploads match data to. This page lists the website's content tables; the migrations
that create them, their access rules and the overlay's tables are in [supabase.md](supabase.md).

The mock JSON files under `data/seeds` are seed inputs only; runtime pages read from the Express
API, which reads Supabase.

## Connection

- Project URL: `SUPABASE_URL`
- Server key: `SUPABASE_SERVICE_ROLE_KEY` (a secret `sb_secret_...` key; server-only)
- Schema: the migrations in [`supabase/migrations/`](../supabase/migrations)
- Server client: [`src/supabase-client.ts`](../src/supabase-client.ts) (scripts use
  `scripts/supabase-client.mjs`)
- Seed scripts: `scripts/seed-home-content.mjs`, `scripts/sync-glossary.mjs`,
  `scripts/sync-hero-videos.mjs`
- External sync script: `scripts/sync-external-sources.mjs`
- Hero wiki sync script: `scripts/sync-heroes.mjs`

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

Row-level security is on for every table below. Apart from `hero_videos`, none has a policy, so
only the server's secret key reads or writes them.

### `hero_content`

Stores one row per hero and keeps the complete source object in `raw_json` so the current Angular data model can be served without losing nested fields. Every writer goes through the `save_hero` function ([supabase.md](supabase.md#website-hero-data)).

### `hero_list_items`

Stores repeated hero values:

- `strength`
- `weakness`
- `counter`
- `synergy`

### `hero_abilities`

Stores hero abilities. Default abilities use empty `kit_role` and `kit_label`; role-specific kits, such as Deadpool's Vanguard/Duelist/Strategist pools, set those fields.

### `hero_videos`

Stores hero-specific and role-fallback YouTube video mappings used by the Heroes page.
PAZ gameplay and counters/combos videos are seeded here so the page does not carry those mappings in component code.

### `home_portals`

Stores the home page portal cards.

### `home_content_blocks`

Stores the remaining home page content blocks by key, including stats, news cards, featured guides, quick links, and current focus copy, as `payload jsonb`.

### `glossary_terms`

Stores the glossary content and keeps the full source object in `raw_json`.

### `external_sources`

Stores cached payloads from external APIs such as Fandom. This lets the app read stable database-backed data while still giving us a refresh path.

### `sync_runs`

Stores update history for external sync jobs.

### `game_stat_snapshots`

Stores one game-stat capture header per UTC hour. The unique `capture_bucket` prevents page traffic and cron retries from creating duplicate hourly snapshots.

### `game_stat_snapshot_games`

Stores the per-game values for each snapshot, including current players, 24-hour peak, all-time peak, daily rank, seller rank, review text, and source URL. The Game Stats API joins the latest incoming values with the preceding snapshot to calculate historical deltas.

## API Routes

The Express SSR server exposes read-only routes:

- `GET /api/content/status`
- `GET /api/heroes`
- `GET /api/heroes/:id`
- `GET /api/hero-videos`
- `GET /api/home/content`
- `GET /api/home/portals`
- `GET /api/glossary`
- `GET /api/external-sources/:sourceKey`
- `GET /api/game-stats`
- `GET /api/sync/game-stats` (cron or authorized manual sync)

`GET /api/content/status` reports `databaseProvider: "supabase"`, the row count of each content
table, `communityHeroStats`, and `supabase: { configured, reachable }`. It names no database host.

## Update Flow

1. Update curated JSON files or generator scripts.
2. Run `npm run db:seed` to load the seeded content into Supabase (home page tables, glossary terms
   and hero videos; heroes are not seeded).
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
