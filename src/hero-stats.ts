import type {
  HeroStats,
  HeroStatsBelowMinimum,
  HeroStatsHalfSeason,
  HeroStatsHero,
  HeroStatsTier,
} from './contracts/hero-stats.model.js';
import type { TierName } from './contracts/tier-list.model.js';

/**
 * Every hero number on the site is derived here and nowhere else, from the counts in
 * `hero_aggregates`. The rule is the Rivals Pulse overlay's personal tier list
 * (`personal-tier-list.ts`, overlay commit 97ff7eeb885acd91531370c6f6f262e5c839eaca), so the site
 * and the overlay place the same heroes in the same tiers; `hero-stats.spec.ts` carries the
 * overlay's fixtures.
 */

/** Appearances a hero needs before it is placed in a tier. */
export const HERO_STATS_MIN_MATCHES = 10;

/** Pseudo-matches at 50% added to a hero's record, so a short run of wins cannot top the list. */
export const WIN_RATE_PRIOR_MATCHES = 10;

/** The lowest shrunk win rate (0 to 1) each tier takes, best first; anything lower is F. */
export const TIER_CUT_OFFS: readonly (readonly [TierName, number])[] = [
  ['S', 0.62],
  ['A', 0.56],
  ['B', 0.52],
  ['C', 0.48],
  ['D', 0.44],
];
export const LOWEST_TIER: TierName = 'F';
const TIER_ORDER: readonly TierName[] = ['S', 'A', 'B', 'C', 'D', 'F'];

/** `participants.play_mode_id`: -1 is stored when the game did not say which mode a match was. */
export const PLAY_MODE_IDS = { quickMatch: 0, competitive: 1, arcade: 2, practice: 3, unknown: -1 } as const;

/**
 * The modes the numbers blend. Unknown (-1) is left out on purpose: the game reports Practice
 * against bots as Quick Match, so an unlabelled match may be Practice or Arcade, and counting it
 * would let those in. The overlay drops a match with no mode for the same reason.
 */
export const BLENDED_PLAY_MODE_IDS: readonly number[] = [PLAY_MODE_IDS.quickMatch, PLAY_MODE_IDS.competitive];

/** One hero in one half-season and mode, as `read_hero_stats()` returns it. */
export interface HeroAggregateRow {
  halfSeason: number;
  playModeId: number;
  /** The game's hero id, not the site's slug. */
  gameHeroId: number;
  /** Scoreboard lines of this hero in matches with a win or a loss. */
  decidedLines: number;
  wins: number;
  killsSum: number;
  killsN: number;
  deathsSum: number;
  deathsN: number;
  assistsSum: number;
  assistsN: number;
  finalHitsSum: number;
  finalHitsN: number;
}

/** Matches with a win or a loss in one half-season and mode. */
export interface MatchTotalsRow {
  halfSeason: number;
  playModeId: number;
  decidedMatches: number;
}

export interface HalfSeasonStart {
  halfSeason: number;
  startsAt: string;
}

export interface HeroStatsSource {
  halfSeasons: readonly HalfSeasonStart[];
  totals: readonly MatchTotalsRow[];
  heroes: readonly HeroAggregateRow[];
}

export interface DeriveHeroStatsOptions {
  now: Date;
  /**
   * Derive exactly this half-season, with no fall-back to the previous one. A half-season that has
   * not started, or that nothing knows, gives the empty state.
   */
  halfSeason?: number;
  /** Game hero id to the hero's id in `heroes.json`. A game id missing here is left out of the numbers. */
  heroSlugByGameId: ReadonlyMap<number, string>;
}

export interface HeroStatsDerivation {
  stats: HeroStats;
  /** Game hero ids in the counted rows that map to no hero (for example 0, "no hero recorded"). */
  excludedGameIds: number[];
}

/** A hero's record pulled toward 50% by the prior, as a fraction from 0 to 1. */
export function shrunkWinRate(wins: number, appearances: number): number {
  return (wins + WIN_RATE_PRIOR_MATCHES / 2) / (appearances + WIN_RATE_PRIOR_MATCHES);
}

export function tierForShrunkWinRate(rate: number): TierName {
  return TIER_CUT_OFFS.find(([, cutOff]) => rate >= cutOff)?.[0] ?? LOWEST_TIER;
}

/** (kills + assists) over deaths, from totals; a hero with no deaths is divided by 1. */
export function killDeathAssistRatio(kills: number, deaths: number, assists: number): number {
  return (kills + assists) / Math.max(deaths, 1);
}

interface Tally {
  appearances: number;
  wins: number;
  killsSum: number;
  killsN: number;
  deathsSum: number;
  deathsN: number;
  assistsSum: number;
  assistsN: number;
  finalHitsSum: number;
  finalHitsN: number;
}

interface HalfSeasonSnapshot {
  matchesCounted: number;
  tiers: HeroStatsTier[];
  belowMinimum: HeroStatsBelowMinimum[];
  excludedGameIds: Set<number>;
}

export function deriveHeroStats(source: HeroStatsSource, options: DeriveHeroStatsOptions): HeroStatsDerivation {
  const starts = new Map(source.halfSeasons.map((season) => [season.halfSeason, season.startsAt]));
  const known = [...new Set([...starts.keys(), ...source.heroes.map((row) => row.halfSeason)])].sort((a, b) => a - b);
  const current = currentHalfSeason(starts, known, options.now);
  const excludedGameIds = new Set<number>();

  const describe = (id: number): HeroStatsHalfSeason => {
    const next = known.find((other) => other > id && starts.has(other));

    return {
      id,
      label: `Season ${id}`,
      startsAt: starts.get(id) ?? null,
      endsAt: next === undefined ? null : (starts.get(next) ?? null),
    };
  };
  const snapshot = (id: number): HalfSeasonSnapshot => {
    const result = snapshotOf(source, id, options.heroSlugByGameId);
    result.excludedGameIds.forEach((gameId) => excludedGameIds.add(gameId));

    return result;
  };
  const started = current === undefined ? [] : known.filter((id) => id <= current);
  const toStats = (
    shown: number | undefined,
    inPlaceOf: number | undefined,
    result: HalfSeasonSnapshot | undefined,
  ): HeroStats => ({
    status: result !== undefined && result.tiers.length > 0 ? 'ready' : 'not-enough-data',
    minimumMatches: HERO_STATS_MIN_MATCHES,
    halfSeasons: started.map(describe),
    halfSeason: shown === undefined ? null : describe(shown),
    inPlaceOf: inPlaceOf === undefined ? null : describe(inPlaceOf),
    matchesCounted: result?.matchesCounted ?? 0,
    tiers: result?.tiers ?? [],
    belowMinimum: result?.belowMinimum ?? [],
  });

  const finish = (stats: HeroStats): HeroStatsDerivation => ({
    stats,
    excludedGameIds: [...excludedGameIds].sort((a, b) => a - b),
  });

  if (current === undefined) {
    return finish(toStats(undefined, undefined, undefined));
  }

  if (options.halfSeason !== undefined) {
    const asked = options.halfSeason;

    return finish(
      started.includes(asked) ? toStats(asked, undefined, snapshot(asked)) : toStats(undefined, undefined, undefined),
    );
  }

  const now = snapshot(current);
  const previous = [...known].reverse().find((id) => id < current);

  if (now.tiers.length === 0 && previous !== undefined) {
    const before = snapshot(previous);

    if (before.tiers.length > 0) {
      return finish(toStats(previous, current, before));
    }
  }

  return finish(toStats(current, undefined, now));
}

/** The latest half-season that has started, or the latest with any counts when no start date says. */
function currentHalfSeason(starts: ReadonlyMap<number, string>, known: readonly number[], now: Date): number | undefined {
  const started = known.filter((id) => {
    const start = Date.parse(starts.get(id) ?? '');

    return !Number.isNaN(start) && start <= now.getTime();
  });

  return started.at(-1) ?? known.at(-1);
}

function snapshotOf(
  source: HeroStatsSource,
  halfSeason: number,
  heroSlugByGameId: ReadonlyMap<number, string>,
): HalfSeasonSnapshot {
  const blended = (row: { halfSeason: number; playModeId: number }): boolean =>
    row.halfSeason === halfSeason && BLENDED_PLAY_MODE_IDS.includes(row.playModeId);

  const matchesCounted = source.totals.filter(blended).reduce((sum, row) => sum + row.decidedMatches, 0);
  const tallies = new Map<string, Tally>();
  const excludedGameIds = new Set<number>();

  for (const row of source.heroes.filter(blended)) {
    const slug = heroSlugByGameId.get(row.gameHeroId);

    if (slug === undefined) {
      excludedGameIds.add(row.gameHeroId);
      continue;
    }

    const tally = tallies.get(slug) ?? emptyTally();
    tally.appearances += row.decidedLines;
    tally.wins += row.wins;
    tally.killsSum += row.killsSum;
    tally.killsN += row.killsN;
    tally.deathsSum += row.deathsSum;
    tally.deathsN += row.deathsN;
    tally.assistsSum += row.assistsSum;
    tally.assistsN += row.assistsN;
    tally.finalHitsSum += row.finalHitsSum;
    tally.finalHitsN += row.finalHitsN;
    tallies.set(slug, tally);
  }

  const lines = [...tallies]
    .filter(([, tally]) => tally.appearances > 0)
    .map(([hero, tally]) => ({ hero, tally, shrunk: shrunkWinRate(tally.wins, tally.appearances) }));

  const byTier = new Map<TierName, HeroStatsHero[]>();
  lines
    .filter(({ tally }) => tally.appearances >= HERO_STATS_MIN_MATCHES)
    .sort((a, b) => b.shrunk - a.shrunk || b.tally.appearances - a.tally.appearances || a.hero.localeCompare(b.hero))
    .forEach(({ hero, tally, shrunk }) => {
      const tier = tierForShrunkWinRate(shrunk);
      byTier.set(tier, [...(byTier.get(tier) ?? []), heroLine(hero, tally, shrunk, tier, matchesCounted)]);
    });

  return {
    matchesCounted,
    tiers: TIER_ORDER.filter((name) => byTier.has(name)).map((name) => ({ name, heroes: byTier.get(name) ?? [] })),
    belowMinimum: lines
      .filter(({ tally }) => tally.appearances < HERO_STATS_MIN_MATCHES)
      .map(({ hero, tally }) => ({ hero, appearances: tally.appearances }))
      .sort((a, b) => b.appearances - a.appearances || a.hero.localeCompare(b.hero)),
    excludedGameIds,
  };
}

// Built field by field rather than spread from the tally, so a field added to the rows can never
// reach the public response without being named here.
function heroLine(hero: string, tally: Tally, shrunk: number, tier: TierName, matchesCounted: number): HeroStatsHero {
  return {
    hero,
    appearances: tally.appearances,
    wins: tally.wins,
    winRate: (tally.wins / tally.appearances) * 100,
    pickRate: matchesCounted > 0 ? (tally.appearances / matchesCounted) * 100 : 0,
    shrunkWinRate: shrunk * 100,
    tier,
    kda:
      tally.killsN > 0 && tally.deathsN > 0 && tally.assistsN > 0
        ? killDeathAssistRatio(tally.killsSum, tally.deathsSum, tally.assistsSum)
        : null,
    finalHitsAverage: tally.finalHitsN > 0 ? tally.finalHitsSum / tally.finalHitsN : null,
  };
}

function emptyTally(): Tally {
  return {
    appearances: 0,
    wins: 0,
    killsSum: 0,
    killsN: 0,
    deathsSum: 0,
    deathsN: 0,
    assistsSum: 0,
    assistsN: 0,
    finalHitsSum: 0,
    finalHitsN: 0,
  };
}
