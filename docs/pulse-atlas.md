# Pulse Atlas

Pulse Atlas is a public, read-only feed of reference data, published as static
JSON files on GitHub Pages. The Overwolf overlay and other tools read it
without calling the Vercel API, holding a key or touching a database. Parent
work: issue 100 (the move to Supabase); this feed is its public read contract.

Base URL: `https://anthonyturner.github.io/rivals-pulse-web/pulse-atlas/v1/`

## What a figure waits on

A figure that is not shown yet waits on a minimum, and a reader can draw "N of M"
progress when the file states both. Every number here is a count, never who made it,
and a field a file does not carry means "no progress to show": fall back to plain copy.

| File | Minimum it states | Count so far for a figure below it |
| --- | --- | --- |
| `hero-stats.json` | `minimumMatches`, `minimumPlayers` | `appearances` and, when counted, `players` on a cell with `enoughData: false` |
| `tier-list.json` and `tier-list/seasons/<id>.json` | `minimumMatches`, `minimumPlayers` on each rank snapshot | `matches` on each `belowMinimum` row, always present, and `players` when counted |
| `community-stats.json` | `minimumMatches`, `minimumPlayers` | none: a pair below the minimum is left out, not listed |
| `hero-scores.json` | `minimums`, and `qualifiedHeroes` for how many heroes pass | `matches` (in steps of 5) and `contributors` on a stat that is `collecting` |
| `team-lineups.json` | `minimumTeams`, `minimumPlayers` | `teams` on a shape with status `not-enough-data` |

**Players are a gate on hero stats and the tier list.** The database counts the
different players who recorded the matches a hero appeared in. `hero-stats.json` and the
tier list state `minimumPlayers` (2, the community rule), and a hero is placed (and gets
`enoughData: true`) only once it has the match minimum **and** that many players. A hero
short of either keeps its `matches` and `players`, which lets a reader draw "1 of 2
players" beside "6 of 10 matches"; a hero with enough of both carries no `players`.
A `players` field that is missing means the database never counted it, which is the case
for every half-season that was frozen before the count existed and for every hero until
the database migration that adds the count has run; it is never `0`, and a hero without
it is placed on the match minimum alone, so past half-seasons keep their placements. A hero's count is for the
mode asked for; in the Quick Match and Competitive blend it counts each person once
whichever of the two they played, so two players who each recorded in a different mode
are 2. A half-season frozen after the per-mode count but before the blended one has no blended
count, and its blend reads the largest per-mode count, which can only undercount. There is still no per-shape `players` in
`team-lineups.json`. The site records no bans at all, so there is no `minimumBanMatches`
or `banMatches`. A reader must not infer a rule from a field that is missing.

**Own games.** `hero-scores.json` rounds a below-minimum `matches` down to a multiple of
5 because that count is one player's own lines on a hero. The other counts are scoreboard
lines or teams across everyone in the matches, so they are exact. A new count that
measures one player's own games must follow the same rounding.

## Files

| File | Holds |
| --- | --- |
| `heroes.json` | The hero list as `GET /api/heroes` returns it, without each hero's `counters`, plus each hero's numeric `gameId` (see below). |
| `tier-list.json` | The community tier list's index: the current season's ranks, plus each season's details with the path and hash of its own file. Shape below. |
| `tier-list/seasons/<id>.json` | One season's ranks, one file per season, current season included. Shape below. **Not** in the manifest. |
| `glossary.json` | The glossary terms, exactly as `GET /api/glossary` returns them. |
| `maps.json` | Map ids to names: a list of `{ "id": number, "name": string }`. Source: [data/pulse-atlas/seed-maps.json](../data/pulse-atlas/seed-maps.json), copied unchanged from the overlay repo's `src/app/data/seed-maps.json`. |
| `hero-styles.json` | Each hero's playstyle mix: whole-number percentages of Poke, Dive and Brawl. Shape below. Source: [data/pulse-atlas/hero-styles.json](../data/pulse-atlas/hero-styles.json), hand-maintained in this repository. |
| `strategist-tags.json` | Each Strategist's tag, `utility` or `healer`, which names a triple-support team. Shape and the naming rules below. Source: [data/pulse-atlas/strategist-tags.json](../data/pulse-atlas/strategist-tags.json), hand-maintained in this repository. |
| `hero-stats.json` | Each hero's community stats in every half-season that has started: win rate, pick rate, KDA, final hits and the matches behind them, with an "enough data" flag per hero. One file for all half-seasons. Shape below. |
| `community-stats.json` | The community's counter and partner counts: how often each hero beat or lost to each enemy hero, and to each ally hero it played with, in the half-season shown. Counts only. Shape below. Optional: absent until the first successful run that can build it. |
| `hero-scores.json` | Each hero's 1 to 10 Damage, Sustain, Ultimate and Utility scores with the figures behind them, or how far along a hero below the rule is, in the half-season shown. Shape below. Optional: absent until the first successful run that can build it. |
| `team-lineups.json` | The community's team line-up shapes (how many Vanguards, Duelists and Strategists a team ran, such as 1-2-3) with the teams and wins behind each, in the half-season shown. Counts only. Shape below. Optional: absent until the first successful run that can build it. |
| `manifest.json` | Every file above with its hash. |

The per-matchup KDA and final hits that `GET /api/hero-matchups` carries (the hero's figures while
facing one enemy hero) are not published here yet: `community-stats.json` holds win and loss counts only. Its
`counters` are directional hero-against-enemy records, so that is where they would go, and the work is tracked in [#680](https://github.com/anthonyturner/rivals-pulse-web/issues/680).

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
([src/server/heroes/stats/hero-stats.ts](../src/server/heroes/stats/hero-stats.ts)). It does not use any third-party
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
          "minimumMatches": 10,
          "minimumPlayers": 2,
          "belowMinimum": [{ "heroId": 1016, "matches": 4, "players": 1 }]
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
- **A rank snapshot is** `{ tiers, matchesCounted?, minimumMatches?, minimumPlayers?, belowMinimum?, fallbackFromSeasonId? }`.
  `tiers` may be empty. `matchesCounted` is the number of matches the numbers
  are pooled from. `minimumMatches` is the appearances a hero needs before it is
  placed (10), so `matches` over `minimumMatches` is a hero's progress; it is a
  whole number above 0 and absent from a file published before it existed.
  `minimumPlayers` is the different players a hero needs besides the matches (2),
  not applied to a hero with no `players`. `belowMinimum` lists the heroes that have data but too few
  matches or too few players to be placed, as `{ heroId, matches, players? }`, with `matches` always present and
  exact and `players` the different players counted so far when the database counted them
  (see "Players are a gate on hero stats and the tier list" above); such a hero has no tier, which
  is not the same as the lowest one. No name or id is published below the minimum
  that is not in this list. `fallbackFromSeasonId` is set only when the
  current season has no placed hero yet and the snapshot holds the previous
  season's numbers instead; it names that previous season.
- **A season can have no hero at all.** A new half-season starts with too few
  matches, so its snapshot is `{ "tiers": [] }` with its counts. It is published
  as it is, with a warning on the workflow run, and the overlay shows "not
  enough data yet". It does not hold up the feed.
- **The files do not name or link a source.** There is no `sourceName` or
  `sourceUrl`, and the generator refuses to build if any published value names
  the old third-party tier-list site (Rivals Meta) or links to it, because the
  overlay ships these files inside its package. The envelope's `source` is `rivals-pulse-web:hero-stats-api`.
- `rankFilters` is only `{ "value": "99", "label": "All Ranks" }`. A snapshot's
  `ranks` key is that value.
- `seasons` is the list of started half-seasons the hero-stats API reports, so
  a new half-season appears without a code change.
- The generator fails, and nothing is published, if a hero-stats answer is
  missing or is for another half-season than asked for, if `currentSeasonId` is
  not a listed season, if a hero row has no integer `heroId` or a non-numeric
  rate or count, or if a snapshot's `matchesCounted`, `minimumMatches`,
  `minimumPlayers`, `belowMinimum` (`players` included) or `fallbackFromSeasonId` is malformed.

### The `hero-stats` data

The per-hero numbers behind the tier list, for readers that want the figures
and not the tiers. Like the tier list it is the **community** data: built from
the matches Rivals Pulse players upload, by the hero-stats derivation behind
`GET /api/hero-stats` ([src/server/heroes/stats/hero-stats.ts](../src/server/heroes/stats/hero-stats.ts)), and from
nothing else. It is **one file for every half-season**, listed in the manifest:

```json
{
  "provenance": "rivals-pulse-community",
  "minimumMatches": 10,
  "minimumPlayers": 2,
  "currentSeasonId": 21,
  "seasons": [
    {
      "id": 21, "label": "Season 10.5", "startTime": "2026-10-09T09:00:00Z",
      "decidedMatches": 146,
      "heroes": [
        { "heroId": 1016, "appearances": 4, "enoughData": false, "players": 1, "winRate": null, "pickRate": null, "kda": null, "finalHitsAverage": null },
        { "heroId": 1042, "appearances": 25, "enoughData": true, "winRate": 64, "pickRate": 17.12, "kda": 5.35, "finalHitsAverage": 4.5 }
      ]
    }
  ]
}
```

- **`provenance` is `"rivals-pulse-community"`, at the top level of `data`**,
  as in the tier list. The generator refuses to build a table without it and
  the read-back check fails if the written file lacks it.
- **Seasons** are the same as the tier list's: one per started half-season,
  the id is the half-season number times two (10 is 20, 10.5 is 21), oldest
  first, with `startTime` and `endTime` left out when unknown (`endTime` is
  absent on the latest). `currentSeasonId` is the latest half-season whose
  start has passed. Each season is that half-season's **own** numbers: unlike
  the tier list's current snapshot, a season whose own numbers are thin never
  shows the previous season's instead.
- **`decidedMatches`** is the number of matches with a win or a loss in
  Competitive or Quick Match in that half-season: the denominator of the pick
  rate (`matchesCounted` in the hero-stats API). It is `0` for a half-season
  nobody has played.
- **A hero cell is** `{ heroId, appearances, enoughData, players?, winRate, pickRate, kda, finalHitsAverage }`,
  ordered by `heroId`. `heroId` is the game's numeric hero id (the same as in
  the tier list; join it to `heroes.json`). `appearances` is the number of
  scoreboard lines of the hero, so it can exceed `decidedMatches` and
  `pickRate` can exceed 100 when a hero is on both teams. `winRate` and
  `pickRate` are percentages, `kda` is (kills + assists) / deaths over all
  lines, and `finalHitsAverage` is final hits per line, all to two decimals.
  A hero with no match in a half-season has no cell.
- **`enoughData`** is `true` exactly when `appearances` is at least
  `minimumMatches` and the hero is not held for players: a cell with `players` below
  `minimumPlayers` is `false` whatever its appearances (the same rule that places a hero
  in the tier list). The generator refuses a cell where they disagree, including an
  `enoughData: false` cell with enough appearances and no `players` to explain it. A cell with
  `enoughData: false` is "not enough data yet": it still carries its
  `appearances`, but its four figures are `null`, because the API reports only
  the appearances of a hero below the minimum. A cell with `enoughData: true`
  always has `winRate` and `pickRate`; its `kda` or `finalHitsAverage` is `null`
  when no line carried that figure.
- **`players`** is the different players who recorded the matches the hero appeared in,
  a count so far and never who, on a cell with `enoughData: false` only, whole and
  `0` or more. `minimumPlayers` (2, the community rule) is the file's matching minimum,
  and it is enforced. A cell the database never counted has no `players` and is placed
  on `minimumMatches` alone; see "Players are a gate on hero stats and the tier list" above.
- **With no matches the file is still valid.** A half-season nobody has played
  is `{ "decidedMatches": 0, "heroes": [] }`, and the file as a whole stays in
  the same shape.
- **One file, not one per half-season.** The table is about 6 KB per half-season
  with the current heroes (two half-seasons a year), so the whole history stays
  small for years, and a client that syncs what the manifest lists gets it with
  the rest. The tier list is split by season only because each season carries
  every tier row and the overlay downloads a past one on demand; this file
  needs no such mechanism. If it ever grows past a size worth parsing for the
  current season alone, splitting it is a `v2` question.
- **Only these keys are published.** The generator allows exactly the keys
  above (`checkKeys` in [src/server/pulse-atlas/pulse-atlas.ts](../src/server/pulse-atlas/pulse-atlas.ts)) and refuses
  to build if the file, a season or a cell has any other, if a key names
  something private (see below), or if a value is not a number, boolean or
  `null` where one is expected. The file holds no player-level data: no
  names, uids, teams, matches or per-match rows, only per-hero counts and
  averages. A unit test runs the same check.
- A hero in the stats that no `gameId` in `hero-game-ids.json` matches is left
  out, with a warning on the workflow run; a `heroId` that no hero in
  `heroes.json` has as its `gameId` is published, with a warning, as in the tier
  list. Neither holds up the feed.
- Source: the generator reads `/api/hero-stats` once for the list of
  half-seasons and then once per half-season, the current one included
  (`?halfSeason=<number>`), so each season's numbers are its own. The envelope's
  `source` is `rivals-pulse-web:hero-stats-api`.

### The `community-stats` data

The counts behind the community counter and best-partner figures, for readers
that want to show how a hero fares against, and together with, another hero.
Like the tier list it is the **community** data: built from the matches Rivals
Pulse players upload, by the pair derivation behind `GET /api/hero-pairs`
([src/server/heroes/pairs/hero-pairs.ts](../src/server/heroes/pairs/hero-pairs.ts)), and from nothing else. It is **one
file** for the half-season shown, listed in the manifest:

```json
{
  "provenance": "rivals-pulse-community",
  "minimumMatches": 10,
  "minimumPlayers": 2,
  "priorMatches": 10,
  "currentSeasonId": 21,
  "season": { "id": 21, "label": "Season 10.5" },
  "bands": [
    {
      "key": "all", "label": "All Ranks", "decidedMatches": 146,
      "heroes": [{ "heroId": 1042, "appearances": 25, "wins": 16 }],
      "counters": [{ "heroId": 1042, "enemyHeroId": 1011, "matches": 12, "appearances": 14, "wins": 9 }],
      "synergies": [{ "heroId": 1011, "allyHeroId": 1042, "matches": 11, "appearances": 13, "wins": 6 }]
    }
  ]
}
```

- **`provenance` is `"rivals-pulse-community"`, at the top level of `data`**,
  as in the tier list. The generator refuses to build a file without it and the
  read-back check fails if the written file lacks it.
- **Counts only.** There is no win rate, no shrunk rate and no ranking. A reader
  computes a rate as `wins / appearances`, and pulls it toward 50% as if
  `priorMatches` more matches had been played at 50%
  (`(wins + priorMatches / 2) / (appearances + priorMatches)`), the rule the
  tier list uses ([src/server/heroes/stats/hero-stats.ts](../src/server/heroes/stats/hero-stats.ts)). `minimumMatches`
  is the decided matches a pair needs before it is listed; a pair with fewer is
  "not enough data", which is not the same as a pair that lost. A pair below it is
  left out, so the file carries no progress count for one.
- **`minimumPlayers`** is the different players that must have recorded a rank band
  before it is published (2), the `community_bucket_shown` rule in the database
  ([src/server/community/community-minimums.ts](../src/server/community/community-minimums.ts) prints it, and a test compares the two).
  It is a whole number above 0, optional for a file published before it existed.
  The database applies it to rank bands of 0 or more; the `all` band below is built
  from matches with no rank, which that rule does not gate, so today it is the number a
  future rank band will wait on and not a reason the `all` band is short.
  It is the only key with the word "player" that the generator lets through (here
  and in `team-lineups.json`), and only as this count.
- **The season** is as in the tier list: the id is the half-season number times
  two (10 is 20, 10.5 is 21). `currentSeasonId` is the latest half-season whose
  start has passed. `season` is the half-season the counts come from.
  `inPlaceOfSeasonId` is present only when the current half-season has no pair at
  the minimum yet and `season` is the previous half-season's counts. It names the
  **current** half-season that is being replaced (it always equals
  `currentSeasonId`), not the previous one; the previous one is `season.id`. This is the same rule as
  `GET /api/hero-matchups`. Then `heroes` and `decidedMatches` are the previous half-season's too.
- **`bands`** holds one band today, `all` (All Ranks). Rank bands are not
  published yet; a reader must take the band it wants by `key` and ignore keys
  it does not know. The `all` band is built from the matches with **no rank**,
  which is every match today. Once ranks are stored, "no rank" will mean
  "unknown rank", not "all ranks", and the all-ranks band will be built from
  that alone, never by adding the rank bands together, because a rank band the
  database hid for too few recorders would be inside such a sum.
- **`decidedMatches`** is the number of matches with a win or a loss in
  Competitive or Quick Match in that half-season, the same blend as
  `hero-stats.json`. It is `0` for a half-season nobody has played.
- **`heroes`** is each hero's `appearances` (scoreboard lines in those matches,
  so it can exceed `decidedMatches`) and `wins`, from the same per-hero counts as
  `hero-stats.json`, ordered by `heroId`. A hero below `minimumMatches` is
  included, because a reader may need its record; it has no pair.
- **`counters`** are directional: the row `{ heroId, enemyHeroId, ... }` is
  `heroId`'s record in matches where `enemyHeroId` was on the other team, so
  `wins` counts `heroId`'s wins and `appearances` is `heroId`'s scoreboard
  lines in those `matches` decided matches. The row for the opposite direction is
  its own row.
- **`synergies`** are one row per unordered pair of heroes on the same team,
  with `heroId` lower than `allyHeroId`. `appearances` is the number of times a
  team held both in a decided match, so a match where both teams did counts twice
  and `matches` once; `wins` counts those team occurrences that won. A reader
  that wants a hero's partners reads the rows where the hero is either id. A
  hero is never paired with itself (also not Deadpool with another form of
  Deadpool).
- **Hero ids** are the game's numeric ids, as in the tier list; join them to
  `heroes.json`. Deadpool's three role forms are merged under his base id, 1057.
  This merged shape is the contract the overlay reads and it does not change:
  placing Deadpool's duos under the role of the form played (the Team comps page)
  is done only in `GET /api/hero-synergies`, which counts the forms apart and
  names the role on each entry (`heroRole`, `allyRole`). `community-stats.json`
  stays on `GET /api/hero-pairs`, so it needs no version bump and the overlay
  needs no change.
  The database drops every pair of game ids below the minimum before the API
  sees it, so each form needs the minimum on its own, and the merged count can
  understate Deadpool's real total. The minimum is applied again after the merge,
  as a guard if the database function ever lets thinner pairs through. The merge
  adds the forms' match counts, so in the rare match where the two teams field
  different Deadpool forms, `matches` can count it once per form. A game id that no hero in
  `hero-game-ids.json` has (hero id 0 is "no hero recorded") is left out of the
  file; a `heroId` that no hero in `heroes.json` has as its `gameId` is
  published, with a warning, as in the tier list.
- **Only these keys are published.** The generator allows exactly the keys
  above (`readCommunityStats` in [src/server/pulse-atlas/pulse-atlas.ts](../src/server/pulse-atlas/pulse-atlas.ts))
  and refuses to build if the file, a season, a band or a row has any other, if
  a key names something private (the `counters` key is allowed here, because
  these are the site's own counts), if a pair is below `minimumMatches`, is a
  hero with itself, or a synergy is not listed once with the lower id first, or
  if there is no `all` band. The file holds no player-level data: no names, uids,
  teams, matches or per-match rows, only counts per hero and per pair.
- **It never holds up the feed.** The endpoint and the database function behind
  it are deployed apart from this repository, so a run can come before them, and
  a failure must not stop heroes, the tier list and the rest from refreshing. When
  fetching `/api/hero-pairs` fails (not deployed yet, an error, an answer with no
  half-season yet, an answer that is not the expected shape or fails the checks
  above, including the private-key and credential-value checks), the generator
  keeps the last published `community-stats.json` exactly as it is (same bytes,
  same hash) and warns. It leaves the dataset out of that run, with a warning,
  in three cases:
  - none was ever published (the published file answers 404);
  - the published copy no longer passes the same checks;
  - the published copy could not be read at all, for example because the Pages
    site was unreachable (that one read is tried three times, unless it is a 404).

  A run that leaves the file out removes it from the next deployment until a run
  builds it again. A current half-season that has no pair at the minimum yet is
  not a failure: the file is published with empty `counters` and `synergies`
  (or the previous half-season's, see `inPlaceOfSeasonId`) and the run does not
  warn. Only an answer with no half-season at all warns. A reader must treat the
  file as absent until it exists.
- The envelope's `source` is `rivals-pulse-web:hero-stats-api`.

### The `hero-scores` data

The 1 to 10 hero build scores, for readers that want them without the website. How
they are worked out is in [hero-build-scores.md](hero-build-scores.md). Like the
tier list it is the **community** data. It is **one file** for the half-season
shown, listed in the manifest:

```json
{
  "provenance": "rivals-pulse-community",
  "minimums": { "matches": 10, "contributors": 2, "busiestContributorShare": 1, "rankedHeroes": 5 },
  "qualifiedHeroes": { "damage": 1, "sustain": 1, "ultimate": 0, "utility": 0 },
  "currentSeasonId": 21,
  "season": { "id": 21, "label": "Season 10.5" },
  "heroes": [
    {
      "heroId": 1042,
      "damage": { "status": "scored", "score": 7, "label": "measured", "matches": 42, "contributors": null, "oneContributorAboveHalf": null, "measures": { "damagePerMinute": 812.5 } },
      "sustain": { "status": "ranking-too-small", "score": null, "label": "measured", "matches": 42, "contributors": null, "oneContributorAboveHalf": null, "measures": { "healingPerMinute": 0, "blockedPerMinute": 412.5, "sustainPerMinute": 412.5 } },
      "ultimate": { "status": "collecting", "score": null, "label": "estimated", "matches": 5, "contributors": 1, "oneContributorAboveHalf": false, "measures": null },
      "utility": { "status": "no-measurable-ability", "score": null, "label": "estimated", "matches": 0, "contributors": null, "oneContributorAboveHalf": null, "measures": null },
      "abilities": [{ "slot": "ability_1", "ability": "Bionic Spider-Nest", "alsoIncludes": [], "tag": null, "usesPerTenMinutes": 12.5, "takedownsPerUse": 0.4, "matches": 42 }]
    }
  ]
}
```

- **`provenance` is `"rivals-pulse-community"`, at the top level of `data`.** The
  generator refuses to build a file without it and the read-back check fails if the
  written file lacks it.
- **A hero with no line in the half-season has no row**, which reads as 0 of each
  minimum. With nobody at the rule, which is today, every stat is `collecting`, or
  `no-measurable-ability` for a Utility with nothing to measure, and the file is valid.
  An empty `heroes` is valid too. Hero ids are as in the tier
  list; Deadpool's role forms are merged under 1057.
- **`status`** is `scored`, `collecting`, `ranking-too-small` or
  `no-measurable-ability`. `score` is a whole number from 1 to 10 only when `scored`.
  `measures` is present only for `scored` and `ranking-too-small`: a hero below the
  rule carries no figure. `contributors` and `oneContributorAboveHalf` are present
  only while `collecting`. `label` is fixed per stat.
- **`oneContributorAboveHalf` means "above the published `busiestContributorShare`".**
  The key keeps its name from when the limit was half. It is true only while one
  player holds more than `minimums.busiestContributorShare` of the lines, so it is
  false whenever that share is 1 (no limit), and a reader must not say "more than
  half" unless the share is 0.5. The database decides it
  (`community_max_recorder_share_percent()` in `read_community_hero_scores`). The
  published `busiestContributorShare` is a separate website constant
  (`HERO_SCORE_MINIMUMS` in `src/server/community/extended/hero-scores.ts`): change
  both together, or the flag and the published share disagree.
- **`qualifiedHeroes`** is, for each stat, how many heroes pass the rule: those whose
  stat is `scored` or `ranking-too-small`. Compared with `minimums.rankedHeroes` it is
  the progress toward a ranking ("2 of 5 heroes"). It counts every hero the API
  answered, including one with no `gameId` that the file leaves out. It is optional for a
  file published before it existed, and each count is a whole number of 0 or more.
- **`matches`** is lines (one player on one hero in one match), so two uploaders in
  one lobby count twice. While `collecting` it is rounded down to a multiple of 5, and
  the generator refuses anything else, because an exact count could be one person's own
  games. A reader takes progress from it, such as "5 of 10 matches, 1 of 2 players".
- **`abilities`** lists a slot only once that slot passes the rule on its own.
  `ability` is the slot's base ability (an `Ability` or `Ultimate` in the hero's kit),
  named even when team-ups share the key, because a team-up only replaces it while
  its partner is on the team. It is null only when the slot holds no single base
  ability and its abilities do not all share one name. `alsoIncludes` lists every
  other name on the slot, once each, such as the team-up variants, whose uses are
  counted in with the base ability's; it is empty when there are none. It is
  additive: an answer or file from before it existed has none and still passes, and
  a reader that does not know the key ignores it, so `schemaVersion` stays 1. `tag`
  is the base ability's (or, with no single base ability, the one all of them
  share), null when untagged or they disagree and, for `ultimate`, always.
- **The season** works as in `community-stats`, including `inPlaceOfSeasonId`.
- **Only these keys are published.** The generator allows exactly the keys above
  (`readHeroScores` in [src/server/pulse-atlas/pulse-atlas.ts](../src/server/pulse-atlas/pulse-atlas.ts)) and
  refuses a file, hero, stat, measure or ability with any other, a key naming
  something private, a score off the scale or below the minimum matches, a stat below
  the rule carrying a figure, and a stat with the wrong label. The word `player` in a
  key refuses the build, which is why this file says `contributors` (the exceptions are the
  count `minimumPlayers`, in `community-stats.json` and `team-lineups.json`, and `players`
  on a hero below the minimum in `hero-stats.json` and the tier list, where it must be a whole number). It holds no
  player-level data: no names, uids, teams, matches or per-match rows, and no sum.
- **No shipped overlay reads it.** The overlay reads the manifest entries it asks for
  by name and skips the rest, as it already does for `hero-stats.json`. Nothing here
  may reach the game (overlay ADR-0021), so do not add an overlay reader for it.
- **It never holds up the feed**, by the same rule as `community-stats` below: a
  failure keeps the last published file, or leaves the file out if there is none. The
  source is `/api/community/hero-scores`, and the envelope's `source` is
  `rivals-pulse-web:hero-stats-api`.

### The `team-lineups` data

The team line-up shapes, for readers that want a "Team line-ups" row without the
website. A shape is how many Vanguards, Duelists and Strategists one team ended a
match with, shown in that order, such as `1-2-3`. Like the tier list it is the
**community** data: built from the matches Rivals Pulse players upload, by the
derivation behind `GET /api/team-lineups`
([src/server/heroes/lineups/team-lineups.ts](../src/server/heroes/lineups/team-lineups.ts)), and from nothing else. It
is **one file** for the half-season shown, listed in the manifest:

```json
{
  "provenance": "rivals-pulse-community",
  "status": "ready",
  "minimumTeams": 50,
  "minimumPlayers": 2,
  "mode": "competitive",
  "currentSeasonId": 21,
  "season": { "id": 21, "label": "Season 10.5" },
  "classifiedTeams": 110,
  "unclassifiedTeams": 2,
  "shapes": [
    { "shape": "2-2-2", "vanguards": 2, "duelists": 2, "strategists": 2, "status": "ready", "teams": 67, "wins": 37 },
    { "shape": "1-2-3", "vanguards": 1, "duelists": 2, "strategists": 3, "status": "not-enough-data", "teams": 12, "wins": null }
  ]
}
```

- **`provenance` is `"rivals-pulse-community"`, at the top level of `data`**, as
  in the tier list. The generator refuses to build a file without it and the
  read-back check fails if the written file lacks it.
- **Counts only.** There is no pick rate and no win rate. A reader computes the
  pick rate as `teams / classifiedTeams` and the win rate as `wins / teams`, the
  figures `GET /api/team-lineups` also gives to four decimals.
- **`teams`** is the teams that ran the shape in matches with a win or a loss, so
  a mirror match counts both teams. **`wins`** is those that won.
  **`classifiedTeams`** is every such team whose heroes all have a known role: the
  denominator of the pick rate. **`unclassifiedTeams`** is the teams left out of
  every shape because a hero's role is not known (no hero recorded, an unknown
  id, Deadpool's role-less base form).
- **A shape under `minimumTeams` is "not enough data" and carries only its team count.**
  Its `status` is `not-enough-data`, its `teams` is the teams counted so far (a whole
  number above 0 and under `minimumTeams`, so `teams` over `minimumTeams` is its
  progress) and its `wins` is `null`, so no win rate can be worked out for a handful
  of teams. `teams` is `null` when the database did not report a count, which is
  what the file carried before the database released it. The shape is listed, and no
  name, id or hero is published for it, only the count. The generator refuses a
  file in which such a shape has wins, a `teams` that is not under the minimum
  or is above `classifiedTeams`, whose `minimumTeams` is below 50 (the
  site's own rule, held apart from what the API reports), or in which a `ready`
  shape has fewer than `minimumTeams` teams or more wins than teams. The top-level
  `status` is `ready` when at least one shape is, and `not-enough-data`
  otherwise, which is a designed state, not an error.
- **`minimumPlayers`** is the different players that must have recorded a rank band
  before it is published (2), as in `community-stats`: the same database rule, the same
  caveat that the matches with no rank, which is every match today, are not gated by
  it, and the same optional, whole-number-above-0 value. There is no per-shape player
  count: the database counts players behind a rank band, not behind a shape.
- **`mode`** is the mode the counts use. `GET /api/team-lineups` counts
  **Competitive** when it is asked for no mode, because line-ups are a ranked-play
  question, and the generator takes that default; this differs from
  `community-stats.json` and `hero-stats.json`, which blend Quick Match and
  Competitive. The file says its mode, so a reader never has to assume it. Rank
  bands are not published, as in `community-stats`: the counts are the matches
  with no rank, which is every match today.
- **`shapes`** is ordered as the API orders it: shapes with enough data first,
  most played first, then the shapes under the minimum, each group by shape. A
  reader that wants another order sorts it. A shape is listed at most once.
- **The season** works as in `community-stats`, including `inPlaceOfSeasonId`,
  which is present only when the current half-season has no shape at the minimum
  yet and `season` is the previous half-season's counts.
- **Only these keys are published.** The generator allows exactly the keys above
  (`readTeamLineups` in [src/server/pulse-atlas/pulse-atlas.ts](../src/server/pulse-atlas/pulse-atlas.ts)) and
  refuses a file, season or shape with any other, or a key naming something
  private. It holds no player-level data (ADR-0011 in the overlay repo): no names,
  uids, matches, heroes or per-match rows, only counts per shape.
- **It never holds up the feed**, by the same rule as `community-stats` below: a
  failure keeps the last published file, or leaves the file out if there is none.
  The source is `/api/team-lineups`, and the envelope's `source` is
  `rivals-pulse-web:hero-stats-api`.

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
  `heroes.json` (`findHeroGameIdProblems` in [src/server/pulse-atlas/pulse-atlas.ts](../src/server/pulse-atlas/pulse-atlas.ts),
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
  (`findHeroStyleProblems` in [src/server/pulse-atlas/pulse-atlas.ts](../src/server/pulse-atlas/pulse-atlas.ts),
  which returns these as `errors` and the two cases above as `warnings`). A
  unit test runs the same check on the committed file, so a malformed weight
  fails in a pull request before it can fail a publish.

### The `strategist-tags` data

One entry per Strategist, keyed by the hero's `id` slug in `heroes.json`, in the same envelope as
`hero-styles.json`. It is what the site and the overlay use to name a triple-support team:

```json
[{ "heroId": "mantis", "tag": "utility" }, { "heroId": "luna-snow", "tag": "healer" }]
```

- **`tag` is `utility` or `healer`.** The utility Strategists are exactly `adam-warlock`, `mantis` and
  `ultron`; every other Strategist is a `healer`, `loki`, `white-fox` and `deadpool` included. Readers
  join a `heroId` to a game id through `heroes.json` (`gameId`, and `gameIdVariants`).
- **Deadpool's entry applies only to his Strategist form, id 10573.** His other forms (10571 Vanguard,
  10572 Duelist) are never Strategists, and his base id 1057 has no role. A team with a player on 1057,
  or on hero id 0 (the game's "no hero recorded"), is **unresolved**: it gets no label and no trio. A
  game hero id with no entry in `heroes.json` is unresolved the same way. `hero_id` is the hero each
  player ended the match on.
- **Naming a team.** Count the team's resolved Strategists (a Strategist is a hero whose role is
  Strategist, or Deadpool on 10573):
  - exactly 3: a **triple**. With no utility Strategist it is **"Three healers"**. Otherwise take the
    utility heroes' display names (`heroes.json` `name`), sort them alphabetically, join them with
    `" + "` and add `" triple"`: "Mantis triple", "Adam Warlock + Mantis triple", "Adam Warlock +
    Mantis + Ultron triple";
  - 4 or more: **"Quad support"**, with no trio;
  - fewer than 3: no label.

  The triple is also a **trio** of its three heroes, which the site stores and counts; the label only
  names it, so a pairing such as Ultron and Luna Snow inside a triple stays visible.
  [`GET /api/triple-support-trios`](api-specification.md) returns these labels from the same file.
- Exactly one entry per Strategist is required. The generator refuses to build, and so nothing is
  published, if a hero in `heroes.json` whose role is Strategist (or who has a Strategist form in
  `hero-game-ids.json`) has no entry, a hero is listed twice, an entry names a hero that is not a
  Strategist, a `tag` is neither value, an entry has a key other than `heroId` and `tag`, or the list is
  empty (`findStrategistTagProblems` in
  [src/server/pulse-atlas/strategist-tags.ts](../src/server/pulse-atlas/strategist-tags.ts)). **Add the
  entry in the same pull request that adds a Strategist** (and a `hero_game_roles` row, see
  [supabase.md](supabase.md#triple-support-aggregates)). An entry for a hero that is not in
  `heroes.json` is published as it is and ignored by readers, so a removed hero cannot freeze the feed.
  A unit test runs the same check on the committed file.
- The tags are editorial: Anthony owns the list. Edit the file in a pull request; a merge that
  changes it publishes through the workflow below.

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
with 2 heroes per tier, as an index plus its two season files under `tier-list/seasons/`, hero stats for the same two seasons with one hero that has enough data and one that has not, community stats with 2 heroes, 2 counters and 2 synergies, hero scores with one hero, team line-ups with one shape that has enough data and one that has not (and its team count so far), three glossary terms, the full maps list, the hero-styles and strategist-tags entries of those two heroes, and a manifest
whose hashes match those sample files. Their `source` is
`SAMPLE: trimmed, not live data`, so they cannot be mistaken for the live feed,
and they are not published: the Pages artifact holds only the generated
`dist/pulse-atlas-site` folder. Regenerate them with
`npm run build:pulse-atlas -- --samples docs/pulse-atlas/samples/v1`.

## What it never contains

Player data, secrets, or third-party counter data: no hero `counters` (the
matchup picks derive from a third-party site, so the generator removes them
from every hero) and nothing from the dropped Counter Watch scraper. The one
exception is `community-stats.json`, whose `counters` are the site's own counts
from uploaded matches (see above), and which the generator checks against an
allow-list of keys instead. The generator refuses to build, and so nothing is
published, if any other dataset has a key naming something private (player,
token, secret, email and similar) or a `counters` key, if any dataset has a
value shaped like a credential, or a mention of the dropped counter source. See
`UNSAFE_KEY`, `PRIVATE_KEY` and `UNSAFE_VALUE` in
[src/server/pulse-atlas/pulse-atlas.ts](../src/server/pulse-atlas/pulse-atlas.ts).

## How it is published

[.github/workflows/pulse-atlas.yml](../.github/workflows/pulse-atlas.yml) runs
every six hours, on a push to `master` that touches the generator, and on
demand (`workflow_dispatch`). It runs `npm run build:pulse-atlas`, which:

1. Fetches `/api/heroes` and `/api/glossary` from the public production API
   (`PULSE_ATLAS_API_BASE` overrides the base URL), plus `/api/hero-stats` once
   (the current half-season, with the list of every started half-season) and
   then once per half-season (`?halfSeason=<number>`), the current one
   included. That needs no secret. The tier list and the hero stats are
   assembled from those same answers and the hero ids in `hero-game-ids.json`
   by `assembleCommunityTierList` and `assembleCommunityHeroStats`. Three
   more reads are each made once: `/api/hero-pairs` for `community-stats`,
   `/api/community/hero-scores` for `hero-scores` and `/api/team-lineups` for
   `team-lineups`; see below for what happens when they fail.
2. Reads the maps, hero-styles, strategist-tags and hero-game-ids source files from the repository.
3. Fetches the currently published files from the Pages site, the tier-list
   season files included (`PULSE_ATLAS_PUBLISHED_BASE` overrides the base URL).
   If this fails, for example with a 404 on the first run, everything is built
   fresh.
4. Builds the files and manifest with the pure module
   [src/server/pulse-atlas/pulse-atlas.ts](../src/server/pulse-atlas/pulse-atlas.ts). It slims the tier list and
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
   [src/server/pulse-atlas/pulse-atlas-page.ts](../src/server/pulse-atlas/pulse-atlas-page.ts). It is not part of
   the feed: the manifest does not list it, and clients never need it.

`community-stats`, `hero-scores` and `team-lineups` are the exceptions to the rule below:
`resolveOptionalDataset` in [src/server/pulse-atlas/pulse-atlas.ts](../src/server/pulse-atlas/pulse-atlas.ts) turns any failure to fetch or
assemble one into the last published file (kept byte for byte) or, if none was
ever published, into leaving it out of the run, each with a warning. None of them ever
fails the generate job.

Any other failed fetch (three attempts each), an empty or malformed dataset, or an
unsafe value fails the generate job. The deploy job needs it, so it never runs
and the last good publish stays live.

**Deploy order.** The build reads the live site API, so the web app that serves
`halfSeasons` and `?halfSeason=` on `/api/hero-stats` has to be deployed to
Vercel before the first publish that includes this change. If the workflow runs
against an older deployment, the answer has no `halfSeasons` list, the
generator stops with "is not the hero-stats shape ... Has the web app been
deployed with it?", and the last good feed (including any older tier list)
stays live. Re-run the workflow once the deployment is live.

`community-stats` needs two more things deployed first: the `read_hero_pairs`
migration (`supabase db push`, see [supabase.md](supabase.md)) and the web app
with `/api/hero-pairs`. A run before them still publishes everything else and
warns that `community-stats` was left out (or kept as last published); the first
run after both are live publishes it.

`hero-scores` works the same way: it needs the `read_community_hero_scores`
migration and the web app with `/api/community/hero-scores`. A merge starts a run that
can reach the API before Vercel has deployed it; that run warns, and the next
scheduled run, within six hours, publishes the file.

`team-lineups` needs the `read_team_lineup_shapes` migration and the web app with
`/api/team-lineups`, both already live; it follows the same rule if a run ever
comes first.

To run it by hand: `npm run build:pulse-atlas -- --out <folder>` (Node 24,
which strips TypeScript types itself).
