# ADR-0008: Give each community stat one read function and one home

- **Status:** Accepted on 2026-11-11. A stat that moves, or a new one, amends
  the table under Decision 2 in the same pull request that moves it, and says
  so here under Status. Amended on 2026-11-11 by issue 773: win rate by map
  moved to the Maps tab, shrunk, with the Overview keeping a short list.
- **Date:** 2026-11-11
- **Deciders:** Anthony (maintainer). The Stats hub design was approved on
  2026-11-11 on issue 779.
- **Related:** issue 779 (this record). The Stats hub: issues and pull
  requests 793 (the hub), 794 (nav and redirects) and 800 and 804 (tier list
  and win rates merged into the Heroes tab). Pull request 783, issue 774 (one
  "matches counted" figure). Pull request 798, issues 511 and 801 (one counter
  source). Pull requests 194 (issue 172) and 509 (issue 449), which set the
  match volume band. Issue 773 (community maps). Overlay repo `anthonyturner/rivals_pulse`: issue 1643 (no enemy
  ultimate status). Builds on [ADR-0006](0006-publish-opted-in-player-names-on-pulse-records.md)
  for Pulse Records.

## In plain words

Every community figure on the site (a hero's win rate, a counter, a record,
"matches counted") is worked out in exactly one place and shown on exactly one
tab of the Stats hub. Before this record that knowledge lived in code comments
and scattered sections of `docs/supabase.md`, and the figures drifted: the home
page, the Community page and Game stats showed three different numbers under
the label "matches counted", and the website's counters disagreed with the
overlay's. This record writes down who owns each figure so the next change
starts from the owner instead of adding a second copy.

## Context

- The site's community figures come only from matches RivalsPulse players
  upload from the desktop app. Nothing comes from an outside site. An upload is
  stored by the `track-match-history` Edge Function
  (`supabase/functions/track-match-history/index.ts`), which writes
  `participants` and the extra tables. An hourly job per aggregate rebuilds
  anonymous counts from those rows, and `purge_expired_participants()` freezes
  each half-season before its raw rows go (see [../supabase.md](../supabase.md)).
- Each aggregate has a read function in the database, a reader in
  `src/server/` that parses its answer and derives the rates, a Vercel
  function under `api/` (and an Express route in `src/server.ts`) that serves
  it, and a screen in `src/app/features/` that draws it. Some are also
  published as Pulse Atlas files for the overlay ([../pulse-atlas.md](../pulse-atlas.md)).
- Two things went wrong because nothing named the owner of a figure. Pull request 783
  (issue 774): one label, "matches counted", sat on three counts (393, 484 and "250+"),
  because the hero stats count matches with a win or a loss in two modes, Game
  stats counts every match, and the Community answer rounded the second down
  to a band. Pull request 798 (issues 511 and 801): the website's counter lists read a second aggregate and
  applied their own rule, while the overlay read the published pair counts, so
  a hero was a counter in one place and not the other.
- The Stats hub (`/stats`, [`stats-tabs.ts`](../../src/app/features/stats/stats-tabs.ts))
  now gathers every community figure under seven tabs, so there is one page
  to hold each figure against.

## Decision

**1. One stat, one server read function, one SQL function.** Each stat below
is read by one function in `src/server/` that calls one `public.read_*()`
function. (The pairs, trios, line-up and switch-in readers also call
`readHeroStatsSource` for the half-seasons and per-hero counts, so they all
show the half-season the hero stats show; that is a shared input, not a second
read of their own figure.) An endpoint, a Pulse Atlas file or another stat that needs the same
counts calls that reader. It does not read the table or the SQL function again
and does not re-derive the rate. A derived view (`getHeroMatchups`,
`getRoleStats`, `getHeroSynergies`) calls the owner and says so.

**2. Where each stat lives.** The hub tab is the page that shows it. Every
tab is under `/stats`.

| Stat | Server read | SQL function | API endpoint | Pulse Atlas | Hub tab |
| --- | --- | --- | --- | --- | --- |
| Hero win rate, pick rate, appearances, KDA, final hits, shrunk win rate | `getHeroStats` | `read_hero_stats()` | `GET /api/hero-stats` | `hero-stats.json`, and win and pick rate in `tier-list.json` | Heroes (`/stats/heroes`, table view) |
| Hero tiers (S to F, from the shrunk win rate) | `getHeroStats` | `read_hero_stats()` | `GET /api/hero-stats` | `tier-list.json` | Heroes (`/stats/heroes?view=tiers`) |
| Hero ban rate | none: not collected | none | none | none | Heroes (`/stats/heroes` shows "Ban data: Not collected"); hero pages say the same |
| Damage, healing and damage blocked per minute | `getCommunityFigures` | `read_community_hero_figures()` | `GET /api/community/figures` | none | Heroes (the lead section, by hero) and Roles (by role) |
| Role averages (win rate, kills, deaths, assists, KDA, final hits) | `getRoleStats` | `read_hero_stats()` (the role of each hero comes from `hero_content`) | `GET /api/community/stats` | none | Roles (`/stats/roles`) |
| Hero against hero, and counters (the 3-point edge rule) | `getHeroPairs`; `getHeroMatchups` is its named view | `read_hero_pairs()`; `read_hero_matchups()` only for the KDA and final hits a pair shows | `GET /api/hero-pairs`; `GET /api/hero-matchups` | `community-stats.json` | Matchups (`/stats/matchups`) |
| Kill feed (seen kills per hero pair) | `getCommunityKills` | `read_community_kill_feed()` | `GET /api/community/kills` | none | Matchups (below the counters) |
| Best duos | `getHeroSynergies` | `read_hero_pairs()` (the `with` pairs) | `GET /api/hero-synergies` | `community-stats.json` | Team comps (`/stats/team-comps`) |
| Triple-support trios | `getTripleSupportTrios` | `read_triple_support_trios()` | `GET /api/triple-support-trios` | none | Team comps |
| Line-up shapes | `getTeamLineups` | `read_team_lineup_shapes()` | `GET /api/team-lineups` | `team-lineups.json` | Team comps |
| Win rate by map (shrunk, from the recorder's side), best and worst, and the known maps still waiting for a rate | `getCommunityMatches` | `read_community_matches()` | `GET /api/community/matches` | none (`maps.json` is only map ids and names) | Maps (`/stats/maps`, every map); Overview (`/stats`, the best and worst three and a link) |
| Mode mix, match length, matches per day | `getCommunityMatches` | `read_community_matches()` | `GET /api/community/matches` | none | Overview |
| When players win (weekday, time of day, session position) | `getCommunityInsights` | `read_community_insights()` | `GET /api/community/insights` | none | Overview |
| Records (best single matches) | `getPulseRecords` | `read_pulse_records()` | `GET /api/records` | none | Records (`/stats/records`) |
| Matches counted, and players counted | `getGameCounts` (`matchesCountedIn` picks a half-season) | `read_game_counts()` | `GET /api/game-stats`; also `matchesCounted` in `GET /api/community/matches` | none | Overview |
| Matches with a result | `getHeroStats` (`matchesCounted`) | `read_hero_stats()` | `GET /api/hero-stats` | `decidedMatches` in `hero-stats.json`; `matchesCounted` in each `tier-list` rank | Heroes (the "N matches with a result" label) |

The readers live in `src/server/heroes/` (`stats`, `pairs`, `matchups`,
`lineups`, `trios`, `switch-ins`), `src/server/community/` (`extended`,
`matches`, `insights`), `src/server/game-counts/` and `src/server/records/`.
The rule for "a function that is not in the database yet is the empty state,
any other failure is an error status" is `callReadFunction` and
`callSupabaseFunction` in `src/server/supabase/`.

Two readers are published and shown outside the hub and are named here so
they are not read a second time: `getCommunityHeroScores`
(`read_community_hero_scores()`, `GET /api/community/hero-scores`,
`hero-scores.json`) draws the build scores on a hero's page, and
`getHeroSwitchIns` (`read_hero_switch_ins()`, `GET /api/hero-switch-ins`, no
Atlas file) draws the switch-ins on a hero's page.

**3. "Matches counted" and "matches with a result" are two different counts
and keep their two names.**

- **Matches counted** is `read_game_counts()`'s `matches` for a half-season:
  each match once however many players recorded it, in every mode, with or
  without a win or a loss. The label is `matchesCountedLabel`, which always
  says what it covers ("Matches counted · Season 10.5"). A page that states it
  reads `read_game_counts()` through `getGameCounts`, picking a half-season with
  `matchesCountedIn` where an answer carries one, and always labels it with
  `matchesCountedLabel`, so two figures with this label never cover different
  things.
- **Matches with a result** is the Quick Match and Competitive matches that
  ended in a win or a loss (`hero_aggregate_totals.decided_matches`, or the
  one mode's when a mode is selected). It is the pick rate's denominator. The
  label is `decidedMatchesLabel` ("146 matches with a result"), and it never
  says "counted".
- **The naming trap.** `HeroStats.matchesCounted` in `GET /api/hero-stats`, the
  `matchesCounted` of each rank in the Pulse Atlas `tier-list` and the
  `matchesCounted` of `GET /api/content/status` all mean matches with a result,
  and Atlas `hero-stats.json` calls the same number `decidedMatches`. They are
  not the "matches counted" figure. The field named `matchesCounted` in
  `GET /api/community/matches` (and `GameCountsHalfSeason.matches`) is. Read the
  definition, not the name. These names are published (Atlas `v1`) or cached
  at the CDN, so they are not renamed here; a rename is an Atlas `v2` question.

**4. The volume-band rule for match totals is retired.** Pull request 194
(issue 172, the Community Matches tab) returned the half-season's total as a rounded-down band
(`MATCH_VOLUME_BANDS`, "250+") so that no exact count left the server, and
pull request 509 (issue 449) kept that. Pull request 783 (issue 774) replaced `matchesBand` and `MATCH_VOLUME_BANDS`
with the exact `matchesCounted`, because `GET /api/game-stats` already lists
that count in full, so the band hid nothing and made one figure read three
ways. What stays:

- **No count of a map, mode or day leaves the server.** A hidden bucket could
  be recovered by subtracting the shown ones from the total, so these answers
  carry percentages and minutes only. The one exact count is `matchesCounted`.
- **The kill feed keeps its own band** (`KILL_VOLUME_BANDS`, "25+ seen kills"),
  because the exact count of a shown pair beside hidden ones would give away
  how much the database left out. That rule is about pairs, not about match
  totals.

**5. The website and the overlay share the counter rules.** A hero counters an
enemy when its win rate against that enemy, shrunk by a prior estimated from
the band's heroes, is at least `COUNTER_MIN_EDGE_POINTS` (3) points above its
own shrunk win rate, over at least 10 decided matches. The constant lives in
[`src/contracts/hero-matchups.model.ts`](../../src/contracts/hero-matchups.model.ts)
and the rule in [`hero-pair-edges.ts`](../../src/server/heroes/pairs/hero-pair-edges.ts).
The overlay applies the same rule to the Pulse Atlas `community-stats.json`
(its `community-stats.dataset.ts`), and the shrinking estimator
([`win-rate-prior.ts`](../../src/server/heroes/stats/win-rate-prior.ts)) is a
copy of the overlay's. A change to the number, the minimum or the estimator is
made in both repositories in step. The server sends `isCounter` and `edge`, so
no page repeats the threshold, and every page quotes `COUNTER_MIN_EDGE_POINTS`
in its wording.

**6. Any future "ultimate tracker" covers allies only.** It never shows an enemy
player's ultimate status, enemy cooldowns or other state the game does not show
the player. Overwolf's and NetEase's fair-play rules forbid it, and the overlay
already removed a false claim of it (overlay issue 1643). The web app's own
data keeps to the same line: the extended upload takes a recorder's own figures
and never reads the ultimate data of a roster line (see "Extended upload" in
[../supabase.md](../supabase.md)). `docs/principles.md` lists an "Ultimate
Tracker" among future engines; it is built to this decision or not built.

## Alternatives considered

- **Leave the knowledge in code comments and `docs/supabase.md`.** This was the
  status quo. It answers "how does this aggregate work" but not "which function
  owns this figure and which tab shows it", and the answers to the second
  question are what drifted. Rejected.
- **One read function for every community stat.** It would make "one source"
  trivially true. Rejected: the stats differ in their privacy gates (a hero
  needs 10 appearances and 2 players, a pair band uses the band rule, a record
  names an opted-in player), in when they freeze, and in which are published,
  so one function would carry every gate and fail all of them together.
- **Keep the volume band for match totals.** It kept every count on the site
  inexact. Rejected in pull request 783: the exact total was already public on Game
  stats, so the band protected nothing and caused the mismatch.
- **Rename `HeroStats.matchesCounted` to `decidedMatches` now.** It is the
  clearer name and `hero-stats.json` already uses it. Rejected for now: the
  field is in a published `v1` file the overlay reads and in answers the CDN
  caches, so a rename is a contract change. Labelling the two counts in the
  pages, and recording the trap here, costs nothing and breaks nothing.
- **Let each surface judge counters its own way.** Pull request 798 found the website
  listing 430 counter rows where the shared rule gives 241. Rejected: a hero
  must be a counter on both or neither.
- **Track enemy ultimates, as the original principles note imagined.**
  Rejected on fair-play grounds (Decision 6), however useful the figure.

## Consequences

- **What this makes easier.**
  - A change to a figure starts at its row: one reader, one SQL function, one
    tab to check.
  - A reviewer can reject a second read of the same counts by pointing at the
    table (rule 10).
  - A new page that needs "how many matches" has two named, labelled
    figures to choose from.
- **What this makes harder, or what it costs.**
  - The table is a second place to update when a stat moves or is added, and it
    can go stale. The compliance check below is how it is kept honest.
  - Several readers share one SQL function (`read_hero_stats()` serves the hero
    stats, the tiers and the roles; `read_hero_pairs()` serves counters and
    duos), so changing its answer touches more than one stat.
  - Two published fields keep a name that misleads. The naming trap is a
    documentation fix, not a code fix, until Atlas `v2`.
  - Keeping the counter rule equal to the overlay's needs a change in two
    repositories every time.
- **What now has to be true.**
  - Every stat on the Stats hub appears in the table with one server read.
  - A page that states "matches counted" uses `matchesCountedLabel` over
    `read_game_counts()`; a page that states the pick rate's denominator uses
    `decidedMatchesLabel`.
  - No count of a map, mode or day is added to the Community Matches or
    Insights answers.
  - Nothing reads or shows an enemy ultimate or cooldown.
  - The Maps tab and the Overview's short list read one answer, and the
    ranking lives in `buildMapsView`, so a map is never ranked two ways.

## Compliance

A reviewer checks, for a change that touches a community figure:

- The change edits the reader named in the table, not a copy of its query or
  its rate, and a new stat adds a row. `grep -rnoE "'read_[a-z_]+'" src/server --include=*.ts --exclude=*.spec.ts`
  prints one constant per reader. `hero-switch-ins-read.ts` also reuses
  `fetchHeroMatchupRows` on purpose, for the comparison it draws.
- A new "matches" label is `matchesCountedLabel` or `decidedMatchesLabel`, never
  a hand-written "matches counted". A new field that holds either count names
  which one in its doc comment.
- A new match total in an answer is the exact `matchesCounted`, and a new
  bucket count is not returned at all.
- A change to `COUNTER_MIN_EDGE_POINTS`, the counter minimum or
  `win-rate-prior.ts` names the matching overlay change in the pull request.
- No new field, copy or tool mentions enemy ultimate status.
