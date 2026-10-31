import type {
  HeroStats,
  HeroStatsBelowMinimum,
  HeroStatsHalfSeason,
  HeroStatsHero,
  HeroStatsModeId,
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
 * The modes the numbers blend. Unknown (-1) is left out on purpose: an unlabelled match could be
 * any mode, Practice and Arcade included, and counting it would let those in. The overlay drops a
 * match with no mode for the same reason. Practice against bots is stored as 3, not as Quick Match:
 * every Quick Match match in production has 12 lines on 2 teams (spike issue 216).
 */
export const BLENDED_PLAY_MODE_IDS: readonly number[] = [PLAY_MODE_IDS.quickMatch, PLAY_MODE_IDS.competitive];

export interface PlayMode {
  id: HeroStatsModeId;
  label: string;
  /** The `participants.play_mode_id` values this mode counts. Unknown (-1) is in none of them. */
  playModeIds: readonly number[];
}

/**
 * Every way of counting, in display order: the blend first, then each game mode alone. The hero
 * numbers and the role stats both offer exactly this list.
 */
export const PLAY_MODES: readonly PlayMode[] = [
  { id: 'all', label: 'Quick Match and Competitive', playModeIds: BLENDED_PLAY_MODE_IDS },
  { id: 'quick-match', label: 'Quick Match', playModeIds: [PLAY_MODE_IDS.quickMatch] },
  { id: 'competitive', label: 'Competitive', playModeIds: [PLAY_MODE_IDS.competitive] },
  { id: 'arcade', label: 'Arcade', playModeIds: [PLAY_MODE_IDS.arcade] },
  { id: 'practice', label: 'Practice', playModeIds: [PLAY_MODE_IDS.practice] },
];

const DEFAULT_PLAY_MODE = PLAY_MODES[0];

/**
 * The mode a `mode` query value names: the blend when there is none, and undefined for a value that
 * names no mode, which then counts nothing rather than quietly counting the blend.
 */
export function playModeFromQuery(value: string | undefined): PlayMode | undefined {
  const id = value?.trim().toLowerCase();

  return id === undefined || id === '' ? DEFAULT_PLAY_MODE : PLAY_MODES.find((mode) => mode.id === id);
}

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
  /**
   * The `mode` query value; see `playModeFromQuery`. None counts the Quick Match and Competitive
   * blend, and a value naming no mode counts nothing.
   */
  mode?: string;
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

/** Counts pooled from `hero_aggregates` rows: for one hero here, for one role in the role stats. */
export interface Tally {
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

/**
 * Which half-seasons exist and which is current, from the start dates in `half_seasons` plus the
 * half-seasons that have counts but no start date. Shared by everything that picks a half-season.
 */
export interface HalfSeasonTimeline {
  /** The latest half-season that has started, or undefined before any exists. */
  current: number | undefined;
  /** Every half-season up to and including the current one, oldest first. */
  started: number[];
  describe(id: number): HeroStatsHalfSeason;
  /** The latest known half-season before `id`. */
  previousOf(id: number): number | undefined;
}

export function halfSeasonTimeline(
  halfSeasons: readonly HalfSeasonStart[],
  countedIds: Iterable<number>,
  now: Date,
): HalfSeasonTimeline {
  const starts = new Map(halfSeasons.map((season) => [season.halfSeason, season.startsAt]));
  const known = [...new Set([...starts.keys(), ...countedIds])].sort((a, b) => a - b);
  const current = currentHalfSeason(starts, known, now);

  return {
    current,
    started: current === undefined ? [] : known.filter((id) => id <= current),
    describe: (id) => {
      const next = known.find((other) => other > id && starts.has(other));

      return {
        id,
        label: `Season ${id}`,
        startsAt: starts.get(id) ?? null,
        endsAt: next === undefined ? null : (starts.get(next) ?? null),
      };
    },
    previousOf: (id) => [...known].reverse().find((other) => other < id),
  };
}

export interface HalfSeasonChoice {
  shown?: number;
  /** Set only when `shown` is the previous half-season, standing in for this current one. */
  inPlaceOf?: number;
}

/**
 * Which half-season to show. With `requested`, exactly that one (no fall-back): a half-season that
 * has not started, or that nothing knows, shows none. Without it, the current one, or the previous
 * one while the current is not `isReady` and the previous is.
 */
export function chooseHalfSeason(
  timeline: HalfSeasonTimeline,
  requested: number | undefined,
  isReady: (id: number) => boolean,
): HalfSeasonChoice {
  const { current, started, previousOf } = timeline;

  if (current === undefined) {
    return {};
  }

  if (requested !== undefined) {
    return started.includes(requested) ? { shown: requested } : {};
  }

  const previous = previousOf(current);

  if (previous !== undefined && !isReady(current) && isReady(previous)) {
    return { shown: previous, inPlaceOf: current };
  }

  return { shown: current };
}

export function deriveHeroStats(source: HeroStatsSource, options: DeriveHeroStatsOptions): HeroStatsDerivation {
  const timeline = halfSeasonTimeline(
    source.halfSeasons,
    source.heroes.map((row) => row.halfSeason),
    options.now,
  );
  const mode = playModeFromQuery(options.mode);
  const excludedGameIds = new Set<number>();
  const snapshots = new Map<number, HalfSeasonSnapshot>();
  const snapshot = (id: number): HalfSeasonSnapshot => {
    let result = snapshots.get(id);

    if (result === undefined) {
      result = snapshotOf(source, id, mode?.playModeIds ?? [], options.heroSlugByGameId);
      result.excludedGameIds.forEach((gameId) => excludedGameIds.add(gameId));
      snapshots.set(id, result);
    }

    return result;
  };

  const { shown, inPlaceOf } = chooseHalfSeason(
    timeline,
    options.halfSeason,
    (id) => snapshot(id).tiers.length > 0,
  );
  const result = shown === undefined ? undefined : snapshot(shown);

  return {
    stats: {
      status: result !== undefined && result.tiers.length > 0 ? 'ready' : 'not-enough-data',
      minimumMatches: HERO_STATS_MIN_MATCHES,
      halfSeasons: timeline.started.map(timeline.describe),
      halfSeason: shown === undefined ? null : timeline.describe(shown),
      inPlaceOf: inPlaceOf === undefined ? null : timeline.describe(inPlaceOf),
      mode: mode?.id ?? null,
      modes: PLAY_MODES.map(({ id, label, playModeIds }) => ({
        id,
        label,
        decidedMatches: shown === undefined ? 0 : decidedMatchesOf(source, shown, playModeIds),
      })),
      matchesCounted: result?.matchesCounted ?? 0,
      tiers: result?.tiers ?? [],
      belowMinimum: result?.belowMinimum ?? [],
    },
    excludedGameIds: [...excludedGameIds].sort((a, b) => a - b),
  };
}

/** The latest half-season that has started, or the latest with any counts when no start date says. */
function currentHalfSeason(starts: ReadonlyMap<number, string>, known: readonly number[], now: Date): number | undefined {
  const started = known.filter((id) => {
    const start = Date.parse(starts.get(id) ?? '');

    return !Number.isNaN(start) && start <= now.getTime();
  });

  return started.at(-1) ?? known.at(-1);
}

/** Adds one aggregate row to a tally. The sums and their non-null counts stay separate: they are averaged only at the end. */
export function addRow(tally: Tally, row: HeroAggregateRow): void {
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
}

function decidedMatchesOf(source: HeroStatsSource, halfSeason: number, playModeIds: readonly number[]): number {
  return source.totals
    .filter((row) => row.halfSeason === halfSeason && playModeIds.includes(row.playModeId))
    .reduce((sum, row) => sum + row.decidedMatches, 0);
}

function snapshotOf(
  source: HeroStatsSource,
  halfSeason: number,
  playModeIds: readonly number[],
  heroSlugByGameId: ReadonlyMap<number, string>,
): HalfSeasonSnapshot {
  const matchesCounted = decidedMatchesOf(source, halfSeason, playModeIds);
  const tallies = new Map<string, Tally>();
  const excludedGameIds = new Set<number>();
  const counted = source.heroes.filter((row) => row.halfSeason === halfSeason && playModeIds.includes(row.playModeId));

  for (const row of counted) {
    const slug = heroSlugByGameId.get(row.gameHeroId);

    if (slug === undefined) {
      excludedGameIds.add(row.gameHeroId);
      continue;
    }

    const tally = tallies.get(slug) ?? emptyTally();
    addRow(tally, row);
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

export function emptyTally(): Tally {
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
