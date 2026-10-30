# Pulse Atlas

Pulse Atlas is a public, read-only feed of reference data, published as static
JSON files on GitHub Pages. The Overwolf overlay and other tools read it
without calling the Vercel API, holding a key or touching a database. Parent
work: issue 100 (the move to Supabase); this feed is its public read contract.

Base URL: `https://anthonyturner.github.io/rivals-pulse-web/pulse-atlas/v1/`

## Files

| File | Holds |
| --- | --- |
| `heroes.json` | The hero list as `GET /api/heroes` returns it, without each hero's `counters`, plus each hero's numeric `gameId` (see below). |
| `tier-list.json` | The community tier list's index: the current season's ranks, plus each season's details with the path and hash of its own file. Shape below. |
| `tier-list/seasons/<id>.json` | One season's ranks, one file per season, current season included. Shape below. **Not** in the manifest. |
| `glossary.json` | The glossary terms, exactly as `GET /api/glossary` returns them. |
| `maps.json` | Map ids to names: a list of `{ "id": number, "name": string }`. Source: [data/pulse-atlas/seed-maps.json](../data/pulse-atlas/seed-maps.json), copied unchanged from the overlay repo's `src/app/data/seed-maps.json`. |
| `hero-styles.json` | Each hero's playstyle mix: whole-number percentages of Poke, Dive and Brawl. Shape below. Source: [data/pulse-atlas/hero-styles.json](../data/pulse-atlas/hero-styles.json), hand-maintained in this repository. |
| `manifest.json` | Every file above with its hash. |

Every dataset file has this shape:

```json
{ "schemaVersion": 1, "generatedAt": "2026-10-26T12:00:00.000Z", "source": "rivals-pulse-web:content-api", "data": [] }
```

- `schemaVersion` is the contract version. It only changes with the URL
  version (`v1`); a breaking change publishes under `v2` and keeps `v1` alive
  while overlays still read it.
- `generatedAt` means **when this dataset's data last changed**, not when the
  feed last ran. A run that finds a dataset unchanged keeps the published
  file's exact bytes, so its `generatedAt` and `sha256` stay the same.
- `source` is a provenance label. Its **value** may change when the content
  moves from Turso to Supabase; the **shape** of the file never does. Do not
  branch on it.
- `data` is the dataset itself, unchanged from the source.

### The `tier-list` data

The tier list is the **community list**: it is built from the matches Rivals
Pulse players upload, by the hero-stats derivation behind `GET /api/hero-stats`
([src/hero-stats.ts](../src/hero-stats.ts)). It does not use any third-party
site. There is one **season** per half-season that has started, and each season
has one rank snapshot, `99` (All Ranks), because a player's rank is not stored
with their matches. The feed is split by season so a client reads the current
season and downloads an older one only when a player picks it.

`tier-list.json` is an index, with the current season's ranks on its own entry:

```json
{
  "provenance": "rivals-pulse-community",
  "currentSeasonId": 21,
  "rankFilters": [{ "value": "99", "label": "All Ranks" }],
  "seasons": [
    {
      "id": 20, "label": "Season 10",
      "startTime": "2026-09-11T09:00:00Z", "endTime": "2026-10-09T09:00:00Z",
      "path": "pulse-atlas/v1/tier-list/seasons/20.json", "sha256": "<hex>"
    },
    {
      "id": 21, "label": "Season 10.5",
      "startTime": "2026-10-09T09:00:00Z",
      "path": "pulse-atlas/v1/tier-list/seasons/21.json", "sha256": "<hex>",
      "ranks": {
        "99": {
          "tiers": [{ "name": "S", "heroes": [{ "heroId": 1042, "winRate": 60.85, "pickRate": 7.14, "matches": 140, "wins": 85 }] }],
          "matchesCounted": 1500,
          "belowMinimum": [{ "heroId": 1016, "matches": 4 }]
        }
      }
    }
  ]
}
```

Each season's own file is a standard envelope whose `data` is that season's
details plus its `ranks` (the same object as its index entry, without `path`
and `sha256`), at `pulse-atlas/v1/tier-list/seasons/<id>.json`. The current
season has a file too, so a client can treat every season the same way.

- **`provenance` is `"rivals-pulse-community"`, at the top level of `data` in
  the index and in every season file.** The overlay refuses a tier-list file
  without it, so a file from any other source can never be shown. The generator
  refuses to build if the tier list it was given does not carry it, and the
  read-back check fails if a written file lacks it.
- **A season id is the half-season number times two**: half-season 10 is 20 and
  10.5 is 21. The current season is the latest half-season whose start has
  passed.
- **Only the current season has `ranks` in the index.** Every other entry has
  none. The season files are **not** listed in `manifest.json`, so a client that
  syncs everything the manifest lists never downloads them.
- **`path` is relative to the site root**, like the manifest's, and is always
  `pulse-atlas/v1/tier-list/seasons/<id>.json`. A client may build the URL from
  the season id and add `?v=<sha256>` to bust caches.
- **`sha256` is the hash of the season file's exact published bytes** (lowercase
  hex of the file as served, trailing newline included), the same rule as the
  manifest. A client fetches a season on first use, keeps it, and fetches it
  again only when the index shows a different `sha256`. The generator reads
  every season file back and checks it against the index before publishing.
- **A hero row is** `{ heroId, winRate, pickRate, matches, wins }`. `heroId` is
  the game's numeric hero id (Deadpool is published under his base id, 1057,
  which the overlay's hero catalog resolves with his three role ids). `matches`
  is the number of scoreboard lines of the hero (`appearances` in the hero-stats
  API), so it can exceed `matchesCounted`. There is no ban rate and no score.
  `name`, `role`, `imageUrl` and `tier` are left out (the enclosing
  `tiers[].name` is the tier), and the rates are rounded to two decimals. To
  show a name, role or portrait, join `heroId` to a hero's `gameId` in
  `heroes.json` (next section). A hero in the tier list that no `gameId` in
  `heroes.json` matches is published all the same, with a warning on the
  workflow run.
- **A rank snapshot is** `{ tiers, matchesCounted?, belowMinimum?, fallbackFromSeasonId? }`.
  `tiers` may be empty. `matchesCounted` is the number of matches the numbers
  are pooled from. `belowMinimum` lists the heroes that have data but too few
  matches to be placed, as `{ heroId, matches }`; such a hero has no tier, which
  is not the same as the lowest one. `fallbackFromSeasonId` is set only when the
  current season has no placed hero yet and the snapshot holds the previous
  season's numbers instead; it names that previous season.
- **A season can have no hero at all.** A new half-season starts with too few
  matches, so its snapshot is `{ "tiers": [] }` with its counts. It is published
  as it is, with a warning on the workflow run, and the overlay shows "not
  enough data yet". It does not hold up the feed.
- **The files do not name or link a source.** There is no `sourceName` or
  `sourceUrl`, and the generator refuses to build if any published value names
  Rivals Meta or its site, because the overlay ships these files inside its
  package. The envelope's `source` is `rivals-pulse-web:hero-stats-api`.
- `rankFilters` is only `{ "value": "99", "label": "All Ranks" }`. A snapshot's
  `ranks` key is that value.
- `seasons` is the list of started half-seasons the hero-stats API reports, so
  a new half-season appears without a code change.
- The generator fails, and nothing is published, if a hero-stats answer is
  missing or is for another half-season than asked for, if `currentSeasonId` is
  not a listed season, if a hero row has no integer `heroId` or a non-numeric
  rate or count, or if a snapshot's `matchesCounted`, `belowMinimum` or
  `fallbackFromSeasonId` is malformed.

### The hero `gameId`

`heroes.json` carries the game's numeric hero id on each hero, so a consumer
can turn a tier-list `heroId` (or any other game hero id, such as a match
participant's) into a hero without a hero list of its own. It is additive: the
rest of the hero is as `GET /api/heroes` returns it, and a client that ignores
the new fields is unaffected.

```json
{ "id": "peni-parker", "name": "Peni Parker", "gameId": 1042 }
{ "id": "deadpool", "name": "Deadpool", "gameId": 1057,
  "gameIdVariants": [{ "gameId": 10571, "role": "Vanguard" }, { "gameId": 10572, "role": "Duelist" }, { "gameId": 10573, "role": "Strategist" }] }
```

- `gameId` is a whole number above 0 and is unique across all heroes and
  variants. To look a hero up, index `gameId` **and** every
  `gameIdVariants[].gameId` against the hero.
- **Deadpool** is one hero in the feed but the game gives him four ids: 1057
  (his base id, with no role) and one per role form, 10571 (Vanguard), 10572
  (Duelist) and 10573 (Strategist). All four resolve to the single `deadpool`
  hero, and a statistic keyed by game hero id counts as Deadpool's whichever of
  the four it carries. `gameId` is the base id; `gameIdVariants` is present on
  a hero only when the game splits it this way, and `role` is the role of that
  form (the hero's own `role` stays `Multi-Role`).
- It comes from [data/pulse-atlas/hero-game-ids.json](../data/pulse-atlas/hero-game-ids.json),
  hand-maintained in this repository: a list of `{ "id": <slug>, "gameId": <number> }`
  entries, with `gameIdVariants` where the game has them. The generator merges
  it into `heroes.json` and does not publish it as a file of its own, so it is
  not in the manifest. It does not depend on any third-party site. The
  committed ids were copied from the overlay repo's hero catalog seed
  (`src/app/services/hero-catalog/hero-catalog.seed.ts`, `characterIds`), at
  overlay commit `c2d353c005b590f62175272e7540c709199d4151` (the commit that
  last changed that file; `main` was at `97ff7eeb` when it was copied).
- A hero with no entry does not hold up the feed. A new hero is released before
  anyone has looked up its id, so when a hero in `heroes.json` has no entry, or
  an entry names a hero that is not in `heroes.json`, the generator logs a
  warning (an annotation on the workflow run) and still publishes every
  dataset. The hero is published without a `gameId`, and a tier-list `heroId`
  that matches no `gameId` is warned about the same way. A warning, not a
  failure, because the alternative stops heroes, the tier list and the
  glossary from refreshing for every reader until someone adds one number.
  Add the entry in the same pull request that adds a hero.
- The generator refuses to build, and so nothing is published, if the map is
  empty, an entry has no slug, a slug is listed twice, a `gameId` is not a
  whole number above 0 or belongs to two heroes (or to a hero and its own
  variant), `gameIdVariants` is empty or has an entry without a `gameId` and a
  `role` of Vanguard, Duelist or Strategist, or no entry names any hero in
  `heroes.json` (`findHeroGameIdProblems` in [src/pulse-atlas.ts](../src/pulse-atlas.ts),
  which returns these as `errors` and the two cases above as `warnings`). A unit
  test runs the same check on the committed file, so a malformed id fails in a
  pull request before it can fail a publish.

### The `hero-styles` data

One entry per hero in `heroes.json`, keyed by the hero's `id` slug:

```json
[{ "heroId": "magik", "poke": 0, "dive": 80, "brawl": 20 }]
```

- Poke is long-range damage, Dive is getting onto the backline, Brawl is
  close-range group fighting (the glossary terms of the same names). A hero's
  three weights are whole-number percentages that sum to exactly 100; a weight
  may be 0. Deadpool has one blended entry.
- It is a separate file rather than a field of `heroes.json` because that file
  is large and every window parses all of it; this one has its own
  `generatedAt` and validation.
- The numbers are editorial. Edit
  [data/pulse-atlas/hero-styles.json](../data/pulse-atlas/hero-styles.json) in a
  pull request; a merge that changes it publishes through the workflow below.
  Add an entry in the same pull request that adds a hero.
- A hero with no entry does not hold up the feed. A new hero is released before
  anyone has rated its playstyle, so when a hero in `heroes.json` has no entry,
  or an entry names a hero that is not in `heroes.json`, the generator logs a
  warning (an annotation on the workflow run) and still publishes every
  dataset. `hero-styles.json` then holds only the entries that match a hero.
  The overlay leaves such a hero out of its style meter.
- The generator refuses to build, and so nothing is published, if a hero is
  listed twice, a weight is negative, not a whole number, or the three do not
  sum to 100, the list is empty, or no entry names any hero in `heroes.json`
  (`findHeroStyleProblems` in [src/pulse-atlas.ts](../src/pulse-atlas.ts),
  which returns these as `errors` and the two cases above as `warnings`). A
  unit test runs the same check on the committed file, so a malformed weight
  fails in a pull request before it can fail a publish.

`manifest.json`:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-10-26T12:00:00.000Z",
  "files": [{ "dataset": "heroes", "path": "pulse-atlas/v1/heroes.json", "sha256": "<hex>", "bytes": 615438 }]
}
```

`sha256` is the SHA-256 (lowercase hex) of the file's exact bytes as served, and
`bytes` is its size. A client can fetch the manifest first and **skip any file
whose `sha256` it already holds**; the hash only changes when the data does.
The manifest's own `generatedAt` is the latest `generatedAt` among the files.
`path` is relative to the site root, so the file lives at
`https://anthonyturner.github.io/rivals-pulse-web/<path>`.

## Samples

Trimmed samples, produced by the real builder, are in
[docs/pulse-atlas/samples/v1/](pulse-atlas/samples/v1/): two heroes (with their `gameId`), a
tier list trimmed to 2 seasons (the current one and the one before)
with 2 heroes per tier, as an index plus its two season files under `tier-list/seasons/`, three glossary terms, the full maps list, the hero-styles entries of those two heroes, and a manifest
whose hashes match those sample files. Their `source` is
`SAMPLE: trimmed, not live data`, so they cannot be mistaken for the live feed,
and they are not published: the Pages artifact holds only the generated
`dist/pulse-atlas-site` folder. Regenerate them with
`npm run build:pulse-atlas -- --samples docs/pulse-atlas/samples/v1`.

## What it never contains

Player data, secrets, or counter data of any kind: no hero `counters` (the
matchup picks derive from a third-party site, so the generator removes them
from every hero) and nothing from the dropped Counter Watch scraper. The
generator refuses to build, and so nothing is published, if a dataset has a
key naming something private (player, token, secret, email and similar) or a
`counters` key, a value shaped like a credential, or a mention of the dropped
counter source. See `UNSAFE_KEY` and `UNSAFE_VALUE` in
[src/pulse-atlas.ts](../src/pulse-atlas.ts).

## How it is published

[.github/workflows/pulse-atlas.yml](../.github/workflows/pulse-atlas.yml) runs
every six hours, on a push to `master` that touches the generator, and on
demand (`workflow_dispatch`). It runs `npm run build:pulse-atlas`, which:

1. Fetches `/api/heroes` and `/api/glossary` from the public production API
   (`PULSE_ATLAS_API_BASE` overrides the base URL), plus `/api/hero-stats` once
   (the current half-season, with the list of every started half-season) and
   then once per other half-season (`?halfSeason=<number>`). That needs no
   secret. The tier list is assembled from those answers and the hero ids in
   `hero-game-ids.json` by `assembleCommunityTierList`; nothing reads the
   Rivals Meta tables or `/api/tier-list`.
2. Reads the maps, hero-styles and hero-game-ids source files from the repository.
3. Fetches the currently published files from the Pages site, the tier-list
   season files included (`PULSE_ATLAS_PUBLISHED_BASE` overrides the base URL).
   If this fails, for example with a 404 on the first run, everything is built
   fresh.
4. Builds the files and manifest with the pure module
   [src/pulse-atlas.ts](../src/pulse-atlas.ts). It slims the tier list and
   writes one file per season, then hashes each season file's exact content for
   the `tier-list.json` index. It reuses a published file verbatim when its
   data and `source` are unchanged (compared as canonical JSON, so key order
   does not matter), so a season nobody changed keeps its bytes and its hash.
   It writes the files, reads them back and checks every hash and size against
   the manifest, and every season file against the index.

5. Renders a home page from the verified manifest to `index.html` at the site
   root and to `pulse-atlas/v1/index.html`, so opening the site in a browser
   shows what Pulse Atlas is and a table of every file with its size and
   sha256. It is static HTML with inline CSS and no scripts, built by
   [src/pulse-atlas-page.ts](../src/pulse-atlas-page.ts). It is not part of
   the feed: the manifest does not list it, and clients never need it.

Any failed fetch (three attempts each), an empty or malformed dataset, or an
unsafe value fails the generate job. The deploy job needs it, so it never runs
and the last good publish stays live.

**Deploy order.** The build reads the live site API, so the web app that serves
`halfSeasons` and `?halfSeason=` on `/api/hero-stats` has to be deployed to
Vercel before the first publish that includes this change. If the workflow runs
against an older deployment, the answer has no `halfSeasons` list, the
generator stops with "is not the hero-stats shape ... Has the web app been
deployed with it?", and the last good feed (including any older tier list)
stays live. Re-run the workflow once the deployment is live.

To run it by hand: `npm run build:pulse-atlas -- --out <folder>` (Node 24,
which strips TypeScript types itself).
