# Rivals Pulse Coach

Rivals Pulse Coach is an Angular coaching companion for learning Marvel Rivals heroes, matchups, team composition, positioning, and practice habits. It combines live data with curated lessons and interactive tools instead of acting as a static wiki.

## Highlights

- **Hero encyclopedia** - searchable role-based roster with full ability kits, technical stats, matchup notes, synergies, videos, playstyles, and multi-role hero support.
- **Draft and matchup tools** - a six-player team builder with composition scoring, a two-way hero counter explorer, and coach-authored build profiles.
- **Current meta views** - synced ranked tier lists, hourly Steam population snapshots with trends, and a Season 9 win-rate report by rank and hero archetype.
- **Structured coaching** - hero guides, beginner lessons, learning paths, positioning and cover guides, build theory, glossary terms, media tutorials, and a "watch next" quiz.
- **Refreshable content** - Turso-backed hero, home, news, glossary, tier-list, video, and game-stat data populated from official and community sources.

## Explore the App

| Area | Routes |
| --- | --- |
| Heroes and matchups | `/heroes`, `/hero-guides`, `/counters` |
| Draft and meta | `/team-builder`, `/tier-list`, `/win-rates/:season`, `/game-stats` |
| Coaching fundamentals | `/beginner-interactive-guide`, `/techniques`, `/build-theory` |
| Positioning and strategy | `/power-positions`, `/strategic-cover`, `/triple-support-counter` |
| Guided learning | `/learning-paths`, `/media-tutorials`, `/watch-next`, `/glossary` |

## Tech Stack

Angular 20 | TypeScript | Signals | RxJS | Angular SSR | Express | Turso/libSQL | Vercel

## Local Development

Requirements: Node.js 20+, npm, and a Turso database.

```powershell
npm.cmd install
Copy-Item .env.example .env
```

Add your Turso credentials to `.env`:

```env
TURSO_DATABASE_URL=libsql://your-database-your-org.turso.io
TURSO_AUTH_TOKEN=your-token
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
| `npm.cmd run db:seed` | Rebuild Turso content from local seed JSON |
| `npm.cmd run db:sync` | Cache configured external sources |
| `npm.cmd run sync:home-news` | Refresh official news and events |
| `npm.cmd run sync:heroes` | Refresh hero and ability data |
| `npm.cmd run sync:official-heroes` | Refresh official descriptions, kits, and team-ups |
| `npm.cmd run sync:tier-list` | Store the latest ranked tier-list snapshot |
| `npm.cmd run sync:game-stats` | Capture the current hourly game-stat snapshot |
| `npm.cmd run refresh:counters` | Rebuild curated hero counter mappings |
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
         Turso/libSQL
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

Local development and production use the same `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` configuration. The main implementation points are:

- `data/seeds/` - source-controlled seed content
- `scripts/sqlite-schema.sql` - database schema
- `scripts/seed-sqlite.mjs` - local seed importer
- `scripts/sync-*.mjs` - source-specific refresh jobs
- `src/contracts/` - shared API response models
- `src/content-database.ts` - server-side content queries
- `src/server.ts` - Express API and SSR server
- `api/` - Vercel serverless endpoints

Key endpoints include `/api/heroes`, `/api/glossary`, `/api/tier-list`, `/api/game-stats`, `/api/home/content`, and `/api/content/status`.

## Deployment

Vercel uses `vercel.json` and runs:

```powershell
npm run vercel:build
```

Configure these project environment variables:

```text
TURSO_DATABASE_URL
TURSO_AUTH_TOKEN
CRON_SECRET
SYNC_SECRET
```

`CRON_SECRET` authenticates scheduled Vercel cron requests. `SYNC_SECRET` protects manual
production sync requests. Scheduled jobs refresh home news and game statistics; deployments do
not run the full database seed.

## Contributing

Project planning and contribution notes live in [`docs/agile/README.md`](docs/agile/README.md). Before opening a change:

1. Keep the work scoped to its issue or backlog item.
2. Never commit `.env` files, Turso tokens, database exports, build output, or local logs.
3. Run the smallest relevant check, then run `npm.cmd run build` before release.
