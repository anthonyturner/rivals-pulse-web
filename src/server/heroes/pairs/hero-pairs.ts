import type {
  HeroPairs,
  HeroPairsBand,
  HeroPairsCounter,
  HeroPairsHero,
  HeroPairsSynergy,
} from '../../../contracts/hero-pairs.model.js';
import {
  BLENDED_PLAY_MODE_IDS,
  chooseHalfSeason,
  halfSeasonTimeline,
  WIN_RATE_PRIOR_MATCHES,
  type HeroStatsSource,
} from '../stats/hero-stats.js';

/**
 * Every hero-pair count on the site is derived here, from the counts in `hero_pair_aggregates` and
 * the per-hero counts in `hero_aggregates`. Counts only: the shrunk win rate and the edge over a
 * hero's own record are the reader's to compute (`priorMatches` is the prior it should use).
 */

/**
 * Matches with a win or a loss in which a pair was seen before it is shown. Keep it equal to
 * `public.hero_pair_min_matches()`, which the database applies first, per pair of game hero ids.
 * Applying it again here, after Deadpool's role forms are merged, keeps a thinner pair out if that
 * function ever changes. A form below the minimum on its own never reaches the merge, so Deadpool's
 * merged figure can understate his total.
 */
export const HERO_PAIR_MIN_MATCHES = 10;

/** The modes the counts blend: the same Competitive and Quick Match blend as the hero stats. */
export const HERO_PAIR_PLAY_MODE_IDS: readonly number[] = BLENDED_PLAY_MODE_IDS;

/**
 * `rank_bucket` of rows with no rank: every row today. Once buckets of 0 or more exist, -1 means
 * "unknown rank", not "all ranks", so the `all` band is built from these rows alone and never by
 * adding buckets together (a bucket the database hid for too few recorders would be inside the sum).
 */
export const UNKNOWN_RANK_BUCKET = -1;

const ALL_RANKS_BAND = { key: 'all', label: 'All Ranks' } as const;

export type HeroPairKind = 'vs' | 'with';

/**
 * One pair in one half-season, rank bucket and kind, summed over the modes asked for, as
 * `read_hero_pairs()` returns it. A `with` row is stored once per pair, with the lower id first.
 */
export interface HeroPairRow {
  halfSeason: number;
  rankBucket: number;
  kind: HeroPairKind;
  /** The game's hero id, not the site's slug. */
  gameHeroId: number;
  otherGameHeroId: number;
  decidedMatches: number;
  decidedLines: number;
  wins: number;
}

export interface DeriveHeroPairsOptions {
  now: Date;
  /** Game hero id to the hero's base game id (Deadpool's role forms to 1057). A game id missing here is left out. */
  baseGameIdByGameId: ReadonlyMap<number, number>;
}

export interface HeroPairsDerivation {
  pairs: HeroPairs;
  /** Game hero ids in the counted rows that map to no hero (for example 0, "no hero recorded"). */
  excludedGameIds: number[];
}

interface Tally {
  matches: number;
  appearances: number;
  wins: number;
}

interface OrderedPair {
  first: number;
  second: number;
  tally: Tally;
}

interface HalfSeasonSnapshot {
  band: HeroPairsBand;
  excludedGameIds: Set<number>;
}

export function deriveHeroPairs(
  rows: readonly HeroPairRow[],
  source: HeroStatsSource,
  options: DeriveHeroPairsOptions,
): HeroPairsDerivation {
  const timeline = halfSeasonTimeline(
    source.halfSeasons,
    [...rows.map((row) => row.halfSeason), ...source.heroes.map((row) => row.halfSeason)],
    options.now,
  );
  const excludedGameIds = new Set<number>();
  const snapshots = new Map<number, HalfSeasonSnapshot>();
  const snapshot = (id: number): HalfSeasonSnapshot => {
    let result = snapshots.get(id);

    if (result === undefined) {
      result = snapshotOf(rows, source, id, options.baseGameIdByGameId);
      result.excludedGameIds.forEach((gameId) => excludedGameIds.add(gameId));
      snapshots.set(id, result);
    }

    return result;
  };
  const { shown, inPlaceOf } = chooseHalfSeason(timeline, undefined, (id) => hasPairs(snapshot(id).band));
  const band = shown === undefined ? undefined : snapshot(shown).band;

  return {
    pairs: {
      status: band !== undefined && hasPairs(band) ? 'ready' : 'not-enough-data',
      minimumMatches: HERO_PAIR_MIN_MATCHES,
      priorMatches: WIN_RATE_PRIOR_MATCHES,
      halfSeason: shown === undefined ? null : timeline.describe(shown),
      inPlaceOf: inPlaceOf === undefined ? null : timeline.describe(inPlaceOf),
      bands: band === undefined ? [] : [band],
    },
    excludedGameIds: [...excludedGameIds].sort((a, b) => a - b),
  };
}

function hasPairs(band: HeroPairsBand): boolean {
  return band.counters.length > 0 || band.synergies.length > 0;
}

function snapshotOf(
  rows: readonly HeroPairRow[],
  source: HeroStatsSource,
  halfSeason: number,
  baseGameIdByGameId: ReadonlyMap<number, number>,
): HalfSeasonSnapshot {
  const excludedGameIds = new Set<number>();
  const baseIdOf = (gameId: number): number | undefined => {
    const baseId = baseGameIdByGameId.get(gameId);

    if (baseId === undefined) {
      excludedGameIds.add(gameId);
    }

    return baseId;
  };

  return {
    band: {
      ...ALL_RANKS_BAND,
      decidedMatches: source.totals
        .filter((row) => row.halfSeason === halfSeason && HERO_PAIR_PLAY_MODE_IDS.includes(row.playModeId))
        .reduce((sum, row) => sum + row.decidedMatches, 0),
      heroes: heroesOf(source, halfSeason, baseIdOf),
      counters: pairsOf(rows, halfSeason, 'vs', baseIdOf).map(
        ({ first, second, tally }): HeroPairsCounter => ({ heroId: first, enemyHeroId: second, ...tally }),
      ),
      synergies: pairsOf(rows, halfSeason, 'with', baseIdOf).map(
        ({ first, second, tally }): HeroPairsSynergy => ({ heroId: first, allyHeroId: second, ...tally }),
      ),
    },
    excludedGameIds,
  };
}

function heroesOf(
  source: HeroStatsSource,
  halfSeason: number,
  baseIdOf: (gameId: number) => number | undefined,
): HeroPairsHero[] {
  const heroes = new Map<number, HeroPairsHero>();

  for (const row of source.heroes) {
    if (row.halfSeason !== halfSeason || !HERO_PAIR_PLAY_MODE_IDS.includes(row.playModeId)) {
      continue;
    }

    const heroId = baseIdOf(row.gameHeroId);

    if (heroId === undefined) {
      continue;
    }

    const hero = heroes.get(heroId) ?? { heroId, appearances: 0, wins: 0 };
    hero.appearances += row.decidedLines;
    hero.wins += row.wins;
    heroes.set(heroId, hero);
  }

  return [...heroes.values()].filter((hero) => hero.appearances > 0).sort((a, b) => a.heroId - b.heroId);
}

/**
 * The pairs of one kind at the minimum, with the heroes merged to their base ids. A `vs` pair keeps
 * its direction; a `with` pair is one pair in either order, so it is listed with the lower id first
 * and the two orders a merge can produce are added together.
 */
function pairsOf(
  rows: readonly HeroPairRow[],
  halfSeason: number,
  kind: HeroPairKind,
  baseIdOf: (gameId: number) => number | undefined,
): OrderedPair[] {
  const pairs = new Map<string, OrderedPair>();

  for (const row of rows) {
    if (row.halfSeason !== halfSeason || row.rankBucket !== UNKNOWN_RANK_BUCKET || row.kind !== kind) {
      continue;
    }

    const hero = baseIdOf(row.gameHeroId);
    const other = baseIdOf(row.otherGameHeroId);

    // A hero with itself (also Deadpool with another form of Deadpool) says nothing about a pair.
    // Merging forms adds the rows' matches, so the rare match in which the two teams field different
    // Deadpool forms against the same hero counts once per form: `matches` can overcount slightly.
    if (hero === undefined || other === undefined || hero === other || row.decidedLines <= 0) {
      continue;
    }

    const [first, second] = kind === 'with' && other < hero ? [other, hero] : [hero, other];
    const key = `${first}|${second}`;
    const pair = pairs.get(key) ?? { first, second, tally: { matches: 0, appearances: 0, wins: 0 } };
    pair.tally.matches += row.decidedMatches;
    pair.tally.appearances += row.decidedLines;
    pair.tally.wins += row.wins;
    pairs.set(key, pair);
  }

  return [...pairs.values()]
    .filter(({ tally }) => tally.matches >= HERO_PAIR_MIN_MATCHES)
    .sort((a, b) => a.first - b.first || a.second - b.second);
}
