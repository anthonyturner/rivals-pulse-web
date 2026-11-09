import type { HeroMatchup, HeroMatchups } from '../../../contracts/hero-matchups.model.ts';
import type { HeroStatsHalfSeason } from '../../../contracts/hero-stats.model.ts';
import {
  BLENDED_PLAY_MODE_IDS,
  halfSeasonTimeline,
  shrunkWinRate,
  tallyFinalHitsAverage,
  tallyKda,
  type HalfSeasonStart,
  type TallyFigures,
} from '../stats/hero-stats.ts';

/**
 * Every hero-against-hero number on the site is derived here, from the counts in `hero_matchups`.
 * The win rate takes the same shrinkage as the tier rule (`shrunkWinRate` in `hero-stats.ts`).
 * Nothing here ranks or scores a matchup: a record is described, and that is all.
 */

/**
 * Matches with a win or a loss in which two heroes faced each other before the pair is shown.
 * Keep it equal to `public.hero_matchup_min_matches()`, which the database applies first, per pair
 * of game hero ids. Applying it again here, after Deadpool's role forms are merged, keeps a thinner
 * pair out if that function ever changes. A form below the minimum on its own never reaches the
 * merge, so Deadpool's merged figure can understate his total.
 */
export const HERO_MATCHUP_MIN_MATCHES = 10;

/** The modes the matchups blend: the same Competitive and Quick Match blend as the hero stats. */
export const HERO_MATCHUP_PLAY_MODE_IDS: readonly number[] = BLENDED_PLAY_MODE_IDS;

/**
 * The scoreboard figures of a matchup's decided lines, as sums and the counts of lines that recorded
 * each, so rows add up before anything is divided.
 */
export type HeroMatchupFigures = TallyFigures;

/** One hero against one enemy hero in one half-season, summed over the modes asked for. */
export interface HeroMatchupRow {
  halfSeason: number;
  /** The game's hero id, not the site's slug. */
  gameHeroId: number;
  enemyGameHeroId: number;
  decidedMatches: number;
  /** `gameHeroId`'s scoreboard lines in those matches, one per enemy hero it faced. */
  decidedLines: number;
  wins: number;
  /**
   * Null where the database did not count them: an answer from before the figures existed, or a
   * half-season frozen before then. A null is not a row of zeros.
   */
  figures: HeroMatchupFigures | null;
}

interface DeriveHeroMatchupsOptions {
  now: Date;
  /** Game hero id to the hero's id in `heroes.json`. A game id missing here is left out. */
  heroSlugByGameId: ReadonlyMap<number, string>;
}

interface HeroMatchupsDerivation {
  matchups: HeroMatchups;
  /** Game hero ids in the rows that map to no hero (for example 0, "no hero recorded"). */
  excludedGameIds: number[];
}

interface Tally {
  matches: number;
  appearances: number;
  wins: number;
  figures: HeroMatchupFigures;
}

interface HalfSeasonSnapshot {
  matchups: HeroMatchup[];
  excludedGameIds: Set<number>;
}

export function deriveHeroMatchups(
  rows: readonly HeroMatchupRow[],
  halfSeasons: readonly HalfSeasonStart[],
  options: DeriveHeroMatchupsOptions,
): HeroMatchupsDerivation {
  const { current, describe, previousOf } = halfSeasonTimeline(
    halfSeasons,
    rows.map((row) => row.halfSeason),
    options.now,
  );
  const excludedGameIds = new Set<number>();
  const snapshot = (id: number): HalfSeasonSnapshot => {
    const result = snapshotOf(rows, id, options.heroSlugByGameId);
    result.excludedGameIds.forEach((gameId) => excludedGameIds.add(gameId));

    return result;
  };
  const finish = (
    shown: HeroStatsHalfSeason | null,
    inPlaceOf: HeroStatsHalfSeason | null,
    matchups: HeroMatchup[],
  ): HeroMatchupsDerivation => ({
    matchups: {
      status: matchups.length > 0 ? 'ready' : 'not-enough-data',
      minimumMatches: HERO_MATCHUP_MIN_MATCHES,
      halfSeason: shown,
      inPlaceOf,
      matchups,
    },
    excludedGameIds: [...excludedGameIds].sort((a, b) => a - b),
  });

  if (current === undefined) {
    return finish(null, null, []);
  }

  const now = snapshot(current);
  const previous = previousOf(current);

  if (now.matchups.length === 0 && previous !== undefined) {
    const before = snapshot(previous);

    if (before.matchups.length > 0) {
      return finish(describe(previous), describe(current), before.matchups);
    }
  }

  return finish(describe(current), null, now.matchups);
}

/**
 * The matchups at the minimum in one half-season, with the game hero ids named by hero. Exported for
 * the readers that compare another figure with a hero's overall record in the same half-season.
 */
export function snapshotOf(
  rows: readonly HeroMatchupRow[],
  halfSeason: number,
  heroSlugByGameId: ReadonlyMap<number, string>,
): HalfSeasonSnapshot {
  const tallies = new Map<string, { hero: string; enemy: string; tally: Tally }>();
  const excludedGameIds = new Set<number>();

  for (const row of rows.filter((candidate) => candidate.halfSeason === halfSeason)) {
    const hero = heroSlugByGameId.get(row.gameHeroId);
    const enemy = heroSlugByGameId.get(row.enemyGameHeroId);

    if (hero === undefined || enemy === undefined) {
      [row.gameHeroId, row.enemyGameHeroId]
        .filter((gameId) => !heroSlugByGameId.has(gameId))
        .forEach((gameId) => excludedGameIds.add(gameId));
      continue;
    }

    // A hero against itself (also Deadpool against another form of Deadpool) says nothing about a counter.
    if (hero === enemy || row.decidedLines <= 0) {
      continue;
    }

    const key = `${hero}|${enemy}`;
    const entry = tallies.get(key) ?? { hero, enemy, tally: { matches: 0, appearances: 0, wins: 0, figures: noFigures() } };
    entry.tally.matches += row.decidedMatches;
    entry.tally.appearances += row.decidedLines;
    entry.tally.wins += row.wins;
    addFigures(entry.tally.figures, row.figures);
    tallies.set(key, entry);
  }

  return {
    matchups: [...tallies.values()]
      .filter(({ tally }) => tally.matches >= HERO_MATCHUP_MIN_MATCHES)
      .sort((a, b) => a.hero.localeCompare(b.hero) || a.enemy.localeCompare(b.enemy))
      .map(({ hero, enemy, tally }) => matchupLine(hero, enemy, tally)),
    excludedGameIds,
  };
}

function noFigures(): HeroMatchupFigures {
  return {
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

function addFigures(tally: HeroMatchupFigures, figures: HeroMatchupFigures | null): void {
  if (figures === null) {
    return;
  }

  tally.killsSum += figures.killsSum;
  tally.killsN += figures.killsN;
  tally.deathsSum += figures.deathsSum;
  tally.deathsN += figures.deathsN;
  tally.assistsSum += figures.assistsSum;
  tally.assistsN += figures.assistsN;
  tally.finalHitsSum += figures.finalHitsSum;
  tally.finalHitsN += figures.finalHitsN;
}

// Built field by field, so a field added to the rows can never reach the public response without
// being named here.
function matchupLine(hero: string, enemy: string, tally: Tally): HeroMatchup {
  return {
    hero,
    enemy,
    matches: tally.matches,
    appearances: tally.appearances,
    wins: tally.wins,
    winRate: (tally.wins / tally.appearances) * 100,
    shrunkWinRate: shrunkWinRate(tally.wins, tally.appearances) * 100,
    kda: tallyKda(tally.figures),
    finalHitsAverage: tallyFinalHitsAverage(tally.figures),
  };
}
