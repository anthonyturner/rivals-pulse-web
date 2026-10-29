# Pulse Atlas

Pulse Atlas is a public, read-only feed of reference data, published as static
JSON files on GitHub Pages. The Overwolf overlay and other tools read it
without calling the Vercel API, holding a key or touching a database. Parent
work: issue 100 (the move to Supabase); this feed is its public read contract.

Base URL: `https://anthonyturner.github.io/rivals-pulse-web/pulse-atlas/v1/`

## Files

| File | Holds |
| --- | --- |
| `heroes.json` | The hero list as `GET /api/heroes` returns it, without each hero's `counters` (see below). |
| `tier-list.json` | The tier list's index: the current season's ranks, plus each season's details with the path and hash of its own file. Shape below. |
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

The full tier list is 21 seasons by 14 ranks, about 3 MB with every hero row
repeating its name, role and image. It is published slimmed and split by season
so a client reads the current season (about 90 KB) and downloads an older one
only when a player picks it.

`tier-list.json` is an index, with the current season's ranks on its own entry:

```json
{
  "currentSeasonId": 21,
  "rankFilters": [{ "value": "99", "label": "All Ranks" }, { "value": "5+", "label": "Diamond+" }],
  "seasons": [
    {
      "id": 20, "seasonNumber": 10, "half": 1, "subSeason": "S10.0", "label": "Season 10",
      "name": "BUTCHER'S BLASPHEMY", "description": "BUTCHER'S BLASPHEMY", "halfName": "S10.0",
      "startTime": "2026-09-11T09:00:00+00:00", "endTime": "2026-10-09T09:00:00+00:00",
      "path": "pulse-atlas/v1/tier-list/seasons/20.json", "sha256": "<hex>"
    },
    {
      "id": 21, "seasonNumber": 10, "half": 2, "subSeason": "S10.5", "label": "Season 10.5",
      "name": "BUTCHER'S BLASPHEMY", "description": "BUTCHER'S BLASPHEMY", "halfName": "S10.5",
      "startTime": "2026-10-09T09:00:00+00:00", "endTime": "2026-11-13T08:59:59+00:00",
      "path": "pulse-atlas/v1/tier-list/seasons/21.json", "sha256": "<hex>",
      "ranks": {
        "99": { "tiers": [{ "name": "S", "heroes": [{ "heroId": 1042, "winRate": 60.85, "pickRate": 7.14, "banRate": 19.21, "matches": 140939, "wins": 83594, "score": 55 }] }] },
        "5+": { "tiers": [] }
      }
    }
  ]
}
```

Each season's own file is a standard envelope whose `data` is that season's
details plus its `ranks` (the same object as its index entry, without `path`
and `sha256`), at `pulse-atlas/v1/tier-list/seasons/<id>.json`. The current
season has a file too, so a client can treat every season the same way.

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
- **A hero row is** `{ heroId, winRate, pickRate, banRate, matches, wins, score }`.
  `heroId` is the game's numeric hero id. `name`, `role`, `imageUrl` and `tier`
  are left out (the enclosing `tiers[].name` is the tier), and the three rates
  are rounded to two decimals. `heroes.json` has no numeric id, so a client
  needs its own hero id list to show a name or portrait; a hero in the tier
  list that `heroes.json` has no hero of the same name or portrait for is
  published all the same, with a warning on the workflow run.
- **The files do not say where the numbers come from.** The tier-list API
  reports a `sourceName` and `sourceUrl`; the generator drops both, and refuses
  to build if any published value names Rivals Meta or its site, because the
  overlay ships these files inside its package. The envelope's `source` is the
  neutral `rivals-pulse-web:content-api`.
- `seasons` and `rankFilters` are the lists the tier-list API itself reports,
  so a new season or rank appears without a code change. Every season has a
  `ranks` entry for **every** `rankFilters[].value` (the rank value is the key,
  for example `"5+"`).
- A snapshot is `{ tiers }`. `fetchedAt`, `sourceTimestamp` and the per-snapshot
  `updatedAt` are left out: they record when a sync ran (the same value for
  every season, new on every run), not what the tier list says, and would
  change every season's hash with no change in data.
- A rank can legitimately have no heroes (upstream has none for some old
  season and rank pairs, for example season 8 at rank `8`), so an empty
  `tiers` heroes list is published as it is. The generator fails, and nothing
  is published, if a season and rank pair cannot be fetched, if the API falls
  back to a different season or rank than asked for, if a season lists no
  hero at any rank, if `currentSeasonId` is not a listed season, or if a hero
  row has no integer `heroId` or a non-numeric rate or count.

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
[docs/pulse-atlas/samples/v1/](pulse-atlas/samples/v1/): two heroes, a
tier list trimmed to 2 seasons (the current one and the one before) by 2 ranks
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
   (`PULSE_ATLAS_API_BASE` overrides the base URL), plus `/api/tier-list` once
   to learn the seasons and ranks and then once per season and rank
   (`?season=<id>&rank=<rank>`). That needs no secret, and it is the only
   reader to change when content moves to Supabase.
2. Reads the maps and hero-styles source files from the repository.
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

To run it by hand: `npm run build:pulse-atlas -- --out <folder>` (Node 22, or
any Node with type stripping).
