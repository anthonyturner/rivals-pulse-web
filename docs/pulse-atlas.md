# Pulse Atlas

Pulse Atlas is a public, read-only feed of reference data, published as static
JSON files on GitHub Pages. The Overwolf overlay and other tools read it
without calling the Vercel API, holding a key or touching a database. Parent
work: issue 100 (the move to Supabase); this feed is its public read contract.

Base URL: `https://anthonyturner.github.io/rivals-pulse-web/pulse-atlas/v1/`

## Files

| File | Holds |
| --- | --- |
| `heroes.json` | The hero list, exactly as `GET /api/heroes` returns it. |
| `tier-list.json` | The tier list, exactly as `GET /api/tier-list` returns it (the API's default season and rank filter). |
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
- `generatedAt` is the ISO time of the run that produced the file. All files of
  one run share it.
- `source` is a provenance label. Its **value** may change when the content
  moves from Turso to Supabase; the **shape** of the file never does. Do not
  branch on it.
- `data` is the dataset itself, unchanged from the source.

`manifest.json`:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-10-26T12:00:00.000Z",
  "files": [{ "dataset": "heroes", "path": "pulse-atlas/v1/heroes.json", "sha256": "<hex>", "bytes": 615438 }]
}
```

`sha256` is the SHA-256 (lowercase hex) of the file's exact bytes as served, so
a client can fetch the manifest first and skip any file whose hash it already
holds. `path` is relative to the site root, so the file lives at
`https://anthonyturner.github.io/rivals-pulse-web/<path>`.

## What it never contains

Player data, secrets, or any third-party counter-scraper data. The generator
refuses to build, and so nothing is published, if a dataset has a key naming
something private (player, token, secret, email and similar), a value shaped
like a credential, or a mention of the dropped counter source. See
`UNSAFE_KEY` and `UNSAFE_VALUE` in [src/pulse-atlas.ts](../src/pulse-atlas.ts).

## How it is published

[.github/workflows/pulse-atlas.yml](../.github/workflows/pulse-atlas.yml) runs
every six hours, on a push to `master` that touches the generator, and on
demand (`workflow_dispatch`). It runs `npm run build:pulse-atlas`, which:

1. Fetches `/api/heroes`, `/api/tier-list` and `/api/glossary` from the public
   production API (`PULSE_ATLAS_API_BASE` overrides the base URL). That needs
   no secret, and it is the only reader to change when content moves to
   Supabase.
2. Reads the maps source file from the repository.
3. Builds the files and manifest with the pure module
   [src/pulse-atlas.ts](../src/pulse-atlas.ts), writes them, reads them back
   and checks every hash against the manifest.

Any failed fetch (three attempts each), an empty or malformed dataset, or an
unsafe value fails the generate job. The deploy job needs it, so it never runs
and the last good publish stays live.

To run it by hand: `npm run build:pulse-atlas -- --out <folder>` (Node 22, or
any Node with type stripping).
