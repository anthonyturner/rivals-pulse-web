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
| `tier-list.json` | The tier list for **every season and every rank**, so season and rank pickers work offline. Shape below. |
| `glossary.json` | The glossary terms, exactly as `GET /api/glossary` returns them. |
| `maps.json` | Map ids to names: a list of `{ "id": number, "name": string }`. Source: [data/pulse-atlas/seed-maps.json](../data/pulse-atlas/seed-maps.json), copied unchanged from the overlay repo's `src/app/data/seed-maps.json`. |
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

Keyed by season, then by rank:

```json
{
  "sourceName": "Rivals Meta",
  "sourceUrl": "https://rivalsmeta.com/tier-list",
  "currentSeasonId": 21,
  "rankFilters": [{ "value": "99", "label": "All Ranks" }, { "value": "5+", "label": "Diamond+" }],
  "seasons": [
    {
      "id": 21, "seasonNumber": 10, "half": 2, "subSeason": "S10.5", "label": "Season 10.5",
      "name": "BUTCHER'S BLASPHEMY", "description": "BUTCHER'S BLASPHEMY", "halfName": "S10.5",
      "startTime": "2026-10-09T09:00:00+00:00", "endTime": "2026-11-13T08:59:59+00:00", "sourceTimestamp": 1793032041,
      "ranks": {
        "99": { "tiers": [{ "name": "S", "heroes": [{ "heroId": 1042, "name": "Peni Parker", "winRate": 60.7 }] }] },
        "5+": { "tiers": [] }
      }
    }
  ]
}
```

- `seasons` and `rankFilters` are the lists the tier-list API itself reports,
  so a new season or rank appears without a code change. Every season has a
  `ranks` entry for **every** `rankFilters[].value` (the rank value is the key,
  for example `"5+"`).
- A snapshot is `{ tiers }`, with the same hero fields the API returns.
  `fetchedAt` and the per-snapshot `updatedAt` are left out: they record when
  a sync ran, not what the tier list says, and would change the file's hash
  with no change in data.
- A rank can legitimately have no heroes (upstream has none for some old
  season and rank pairs, for example season 8 at rank `8`), so an empty
  `tiers` heroes list is published as it is. The generator fails, and nothing
  is published, if a season and rank pair cannot be fetched, if the API falls
  back to a different season or rank than asked for, or if a season lists no
  hero at any rank.
- The file is about 3 MB uncompressed (about 21 seasons times 14 ranks);
  GitHub Pages serves it compressed, and the manifest hash lets a client skip
  it when nothing changed.

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
tier list trimmed to 2 seasons by 2 ranks with 2 heroes per tier, three glossary terms, the full maps list, and a manifest
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
2. Reads the maps source file from the repository.
3. Fetches the currently published files from the Pages site
   (`PULSE_ATLAS_PUBLISHED_BASE` overrides the base URL). If this fails, for
   example with a 404 on the first run, everything is built fresh.
4. Builds the files and manifest with the pure module
   [src/pulse-atlas.ts](../src/pulse-atlas.ts), which reuses a published file
   verbatim when its data and `source` are unchanged (compared as canonical
   JSON, so key order does not matter). It writes them, reads them back and
   checks every hash and size against the manifest.

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
