import type { TierName } from './tier-list.model.js';

/** One half-season. `endsAt` is the next half-season's start, or null while it is the latest. */
export interface HeroStatsHalfSeason {
  /** The half-season number, such as 10 or 10.5. */
  id: number;
  label: string;
  startsAt: string | null;
  endsAt: string | null;
}

/** One hero's record. Every rate here is a percentage from 0 to 100. */
export interface HeroStatsHero {
  /** The hero's id in `heroes.json`, such as `captain-america`. */
  hero: string;
  /**
   * Scoreboard lines of this hero in matches with a win or a loss. A hero on both teams of one match
   * appears twice, so this can exceed the matches counted and `pickRate` can exceed 100.
   */
  appearances: number;
  wins: number;
  winRate: number;
  /** Lines of this hero as a share of the matches counted. */
  pickRate: number;
  /** The win rate pulled toward 50%, which is what places the hero in a tier. */
  shrunkWinRate: number;
  tier: TierName;
  /** (kills + assists) / deaths over all lines, or null when no line carried the figures. */
  kda: number | null;
  /** Final hits per line, or null when no line carried a final-hits figure. */
  finalHitsAverage: number | null;
}

export interface HeroStatsTier {
  name: TierName;
  heroes: HeroStatsHero[];
}

export interface HeroStatsBelowMinimum {
  hero: string;
  appearances: number;
}

/**
 * Every hero number the site shows, from Rivals Pulse overlay matches only.
 *
 * `ready` means at least one hero has reached `minimumMatches`; `not-enough-data` is a designed state,
 * not an error, and then `tiers` is empty.
 */
export interface HeroStats {
  status: 'ready' | 'not-enough-data';
  minimumMatches: number;
  /** The half-season the numbers come from, or null before any half-season exists. */
  halfSeason: HeroStatsHalfSeason | null;
  /**
   * Set only when `halfSeason` is the previous half-season, shown while this current one is still
   * below the minimum.
   */
  inPlaceOf: HeroStatsHalfSeason | null;
  /** Matches with a win or a loss in Competitive or Quick Match: the pick rate's denominator. */
  matchesCounted: number;
  tiers: HeroStatsTier[];
  belowMinimum: HeroStatsBelowMinimum[];
}
