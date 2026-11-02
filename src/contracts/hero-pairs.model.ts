import type { HeroStatsHalfSeason } from './hero-stats.model.js';

/** One hero's record in a band. Heroes are the game's hero ids, with Deadpool's role forms under 1057. */
export interface HeroPairsHero {
  heroId: number;
  /** Scoreboard lines of the hero in matches with a win or a loss. */
  appearances: number;
  wins: number;
}

/** How `heroId` fared with `enemyHeroId` on the other team. */
export interface HeroPairsCounter {
  heroId: number;
  enemyHeroId: number;
  /** Matches with a win or a loss in which the two met. */
  matches: number;
  /** `heroId`'s scoreboard lines in those matches: what `wins` is counted over. */
  appearances: number;
  wins: number;
}

/** How a pair of heroes fared on one team. Listed once per pair, with `heroId` below `allyHeroId`. */
export interface HeroPairsSynergy {
  heroId: number;
  allyHeroId: number;
  /** Matches with a win or a loss in which a team held both. */
  matches: number;
  /** Team occurrences of the pair in those matches: a match where both teams held it counts twice. */
  appearances: number;
  wins: number;
}

/** The counts of one group of players (today only everyone), for one half-season. */
export interface HeroPairsBand {
  key: string;
  label: string;
  /** Matches with a win or a loss in the half-season in the Quick Match and Competitive blend. */
  decidedMatches: number;
  heroes: HeroPairsHero[];
  counters: HeroPairsCounter[];
  synergies: HeroPairsSynergy[];
}

/**
 * Counts of how heroes fare against and with each other, from RivalsPulse app matches only. Counts
 * only: win rates and shrinkage are the reader's to compute from `priorMatches`.
 *
 * `ready` means at least one pair reached `minimumMatches`; `not-enough-data` is a designed state,
 * not an error, and then every pair list is empty. Pairs below the minimum are never listed.
 */
export interface HeroPairs {
  status: 'ready' | 'not-enough-data';
  minimumMatches: number;
  /** The pseudo-matches at 50% a reader adds to a record before it compares rates. */
  priorMatches: number;
  /** The half-season the counts come from, or null before any half-season exists. */
  halfSeason: HeroStatsHalfSeason | null;
  /** Set only when `halfSeason` is the previous one, shown while the current one has no pair at the minimum. */
  inPlaceOf: HeroStatsHalfSeason | null;
  /** Today only the `all` band; lists are sorted by hero id, which is not a ranking. */
  bands: HeroPairsBand[];
}
