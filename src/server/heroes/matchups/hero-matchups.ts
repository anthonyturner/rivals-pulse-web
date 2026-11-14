import type { HeroMatchup, HeroMatchups } from '../../../contracts/hero-matchups.model.ts';
import type { HeroPairs } from '../../../contracts/hero-pairs.model.ts';
import { counterEdges, meetsMinimumEdge } from '../pairs/hero-pair-edges.ts';
import { BLENDED_PLAY_MODE_IDS, tallyFinalHitsAverage, tallyKda, type TallyFigures } from '../stats/hero-stats.ts';

/**
 * The hero-against-hero numbers on the site. Which pairs exist, their counts and whether one counts
 * as a counter come from the pair counts of `/api/hero-pairs` (`deriveHeroMatchups`): the same
 * counts the overlay reads from Pulse Atlas, under the same rule (`hero-pair-edges.ts`). Only a
 * hero's KDA and final hits while facing an enemy come from `hero_matchups`, because the pair counts
 * do not carry them (`snapshotOf`); they never decide which pair is listed or what its counts are.
 * Nothing here ranks or scores a matchup: a record is described, and that is all.
 */

/**
 * Matches with a win or a loss in which two heroes faced each other before their figures are used.
 * Keep it equal to `public.hero_matchup_min_matches()`, which the database applies first, per pair
 * of game hero ids. Applying it again here, after Deadpool's role forms are merged, keeps a thinner
 * pair out if that function ever changes. A form below the minimum on its own never reaches the
 * merge, so Deadpool's merged figure can understate his total.
 */
export const HERO_MATCHUP_MIN_MATCHES = 10;

/** The modes the matchup figures blend: the same Competitive and Quick Match blend as the pair counts. */
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

/** A hero's record against one enemy hero in `hero_matchups`, with the figures the pair counts lack. */
export interface HeroMatchupRecord {
  hero: string;
  enemy: string;
  matches: number;
  appearances: number;
  wins: number;
  winRate: number;
  kda: number | null;
  finalHitsAverage: number | null;
}

interface DeriveHeroMatchupsOptions {
  /** Game hero id (a base id, for the pair counts) to the hero's id in `heroes.json`. A game id missing here is left out. */
  heroSlugByGameId: ReadonlyMap<number, string>;
}

interface HeroMatchupsDerivation {
  matchups: HeroMatchups;
  /** Game hero ids in the pair counts that map to no hero. */
  excludedGameIds: number[];
}

interface Tally {
  matches: number;
  appearances: number;
  wins: number;
  figures: HeroMatchupFigures;
}

interface HalfSeasonSnapshot {
  matchups: HeroMatchupRecord[];
  excludedGameIds: Set<number>;
}

/**
 * The site's matchups from the pair counts: every counter pair of the `all` band, named by hero,
 * with its shrunk win rate, its edge over the hero's own record and whether that edge makes it a
 * counter. The half-season, its fall-back and the minimum are the pair counts', so both readers show
 * the same ones. `figureRows` are `hero_matchups` rows, used only for each pair's KDA and final hits
 * in the half-season shown.
 */
export function deriveHeroMatchups(
  pairs: HeroPairs,
  figureRows: readonly HeroMatchupRow[],
  options: DeriveHeroMatchupsOptions,
): HeroMatchupsDerivation {
  const band = pairs.bands.find((candidate) => candidate.key === 'all');
  const figures = new Map(
    (pairs.halfSeason === null ? [] : snapshotOf(figureRows, pairs.halfSeason.id, options.heroSlugByGameId).matchups).map(
      (record) => [`${record.hero}|${record.enemy}`, record],
    ),
  );
  const excludedGameIds = new Set<number>();
  const matchups = (band === undefined ? [] : counterEdges(band, pairs.minimumMatches)).flatMap(
    (counter): HeroMatchup[] => {
      const hero = options.heroSlugByGameId.get(counter.heroId);
      const enemy = options.heroSlugByGameId.get(counter.enemyHeroId);

      if (hero === undefined || enemy === undefined) {
        [counter.heroId, counter.enemyHeroId]
          .filter((gameId) => !options.heroSlugByGameId.has(gameId))
          .forEach((gameId) => excludedGameIds.add(gameId));

        return [];
      }

      const figure = figures.get(`${hero}|${enemy}`);

      return [
        {
          hero,
          enemy,
          matches: counter.matches,
          appearances: counter.appearances,
          wins: counter.wins,
          winRate: (counter.wins / counter.appearances) * 100,
          shrunkWinRate: counter.shrunkWinRate * 100,
          edge: counter.edge * 100,
          isCounter: meetsMinimumEdge(counter.edge),
          kda: figure?.kda ?? null,
          finalHitsAverage: figure?.finalHitsAverage ?? null,
        },
      ];
    },
  );

  return {
    matchups: {
      status: matchups.length > 0 ? 'ready' : 'not-enough-data',
      minimumMatches: pairs.minimumMatches,
      halfSeason: pairs.halfSeason,
      inPlaceOf: pairs.inPlaceOf,
      matchups: matchups.sort((a, b) => a.hero.localeCompare(b.hero) || a.enemy.localeCompare(b.enemy)),
    },
    excludedGameIds: [...excludedGameIds].sort((a, b) => a - b),
  };
}

/**
 * The records of `hero_matchups` at the minimum in one half-season, with the game hero ids named by
 * hero and their figures summed. Exported for the readers that compare another figure with a hero's
 * overall record in the same half-season.
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
      .map(({ hero, enemy, tally }) => recordLine(hero, enemy, tally)),
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

function recordLine(hero: string, enemy: string, tally: Tally): HeroMatchupRecord {
  return {
    hero,
    enemy,
    matches: tally.matches,
    appearances: tally.appearances,
    wins: tally.wins,
    winRate: (tally.wins / tally.appearances) * 100,
    kda: tallyKda(tally.figures),
    finalHitsAverage: tallyFinalHitsAverage(tally.figures),
  };
}
