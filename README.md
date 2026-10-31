# Rivals Pulse Coach

Rivals Pulse Coach is an Angular coaching companion for learning Marvel Rivals heroes, matchups, team composition, positioning, and practice habits. It combines live data with curated lessons and interactive tools instead of acting as a static wiki.

## Highlights

- **Hero encyclopedia** - searchable role-based roster with full ability kits, technical stats, matchup notes, synergies, videos, playstyles, and multi-role hero support.
- **Draft and matchup tools** - a six-player team builder with composition scoring, a two-way hero counter explorer, and coach-authored build profiles.
- **Current meta views** - a community tier list built from matches that Rivals Pulse players record, hourly Steam population snapshots with trends, and hero win rates counted from matches that Rivals Pulse players record.
- **Structured coaching** - hero guides, beginner lessons, learning paths, positioning and cover guides, build theory, glossary terms, media tutorials, and a "watch next" quiz.
- **Refreshable content** - Supabase-backed hero, home, news, glossary, video, and game-stat data populated from official and community sources.

## Explore the App

| Area | Routes |
| --- | --- |
| Heroes and matchups | `/heroes`, `/hero-guides`, `/counters` |
| Draft and meta | `/team-builder`, `/tier-list`, `/win-rates`, `/game-stats` |
| Coaching fundamentals | `/beginner-interactive-guide`, `/techniques`, `/build-theory` |
| Positioning and strategy | `/power-positions`, `/strategic-cover`, `/triple-support-counter` |
| Guided learning | `/learning-paths`, `/media-tutorials`, `/watch-next`, `/glossary` |

## Tech Stack

Angular 20 | TypeScript | Signals | RxJS | Angular SSR | Express | Supabase | Vercel

## Local Development

Requirements: Node.js 24, npm, and access to the Supabase project (see [docs/supabase.md](docs/supabase.md)).

```powershell
npm.cmd install
Copy-Item .env.example .env
```

Add the Supabase settings to `.env` (the server key is a secret `sb_secret_...` key; never commit it):

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-secret-key
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Populate the database and start Angular:

```powershell
npm.cmd run content:update
npm.cmd start
```

Open `http://localhost:4200/`.

> `content:update` performs a full seed and external-data refresh. Do not use it against a database you do not intend to overwrite.

## Useful Commands

| Command | Purpose |
| --- | --- |
| `npm.cmd start` | Run the development server |
| `npm.cmd run build` | Build Angular and type-check the API |
| `npm.cmd test` | Run unit tests |
| `npm.cmd run db:seed` | Load the local seed JSON into Supabase: home page portals and blocks, glossary terms and hero videos (heroes are not seeded) |
| `npm.cmd run sync:hero-videos` | Copy the hero videos seed file into Supabase |
| `npm.cmd run sync:glossary` | Copy every glossary term from the seed file into Supabase |
| `npm.cmd run db:sync` | Cache configured external sources |
| `npm.cmd run sync:home-news` | Refresh official news and events |
| `npm.cmd run sync:heroes` | Refresh hero and ability data |
| `npm.cmd run sync:official-heroes` | Refresh official descriptions, kits, and team-ups |
| `npm.cmd run sync:game-stats` | Capture the current hourly game-stat snapshot |
| `npm.cmd run refresh:build-profiles` | Regenerate coach-rated hero build profiles |
| `npm.cmd run content:update` | Run the complete seed and content refresh pipeline |

Targeted glossary updates are available with:

```powershell
npm.cmd run sync:glossary:missing
npm.cmd run sync:glossary:terms -- glnm another-term-id
```

## Content Architecture

```text
Seed JSON + external sources
              |
           Supabase
              |
    Express / Vercel APIs
              |
        Angular pages
```

Application code is organized by responsibility:

```text
src/app/
  core/       # application shell, layout, and navigation
  features/   # home, heroes, learning, insights, tools, community, and reference pages
  shared/     # reusable utilities without feature ownership
```

Seed inputs live in `data/seeds`, outside the Angular application tree. Shared frontend and
server-side response models live in `src/contracts`.

Local development and production use the same `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configuration. The main implementation points are:

- `data/seeds/` - source-controlled seed content
- `supabase/migrations/` - database schema
- `scripts/seed-home-content.mjs` - home page seed importer
- `scripts/sync-*.mjs` - source-specific refresh jobs
- `src/contracts/` - shared API response models
- `src/content-database.ts` - server-side content queries
- `src/server.ts` - Express API and SSR server
- `api/` - Vercel serverless endpoints

Key endpoints include `/api/heroes`, `/api/glossary`, `/api/hero-stats`, `/api/game-stats`, `/api/home/content`, and `/api/content/status`.

## Deployment

Vercel uses `vercel.json` and runs:

```powershell
npm run vercel:build
```

Configure these project environment variables:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_PUBLISHABLE_KEY
CRON_SECRET
SYNC_SECRET
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (a secret `sb_secret_...` key) let server code reach
Supabase; `SUPABASE_PUBLISHABLE_KEY` is the publishable key `/api/hero-stats` and `/api/hero-matchups` read the hero counts with; see [docs/supabase.md](docs/supabase.md). `CRON_SECRET` authenticates scheduled Vercel cron requests. `SYNC_SECRET` protects manual
production sync requests. Scheduled jobs refresh home news and game statistics; deployments do
not run the full database seed.

## Contributing

Project planning and contribution notes live in [`docs/agile/README.md`](docs/agile/README.md). Before opening a change:

1. Keep the work scoped to its issue or backlog item.
2. Never commit `.env` files, Supabase keys, database exports, build output, or local logs.
3. Run the smallest relevant check, then run `npm.cmd run build` before release.
