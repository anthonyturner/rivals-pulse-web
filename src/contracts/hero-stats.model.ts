import type { TierName } from './tier-list.model.js';

/** One half-season. `endsAt` is the next half-season's start, or null while it is the latest. */
export interface HeroStatsHalfSeason {
  /** The half-season number, such as 10 or 10.5. */
  id: number;
  label: string;
  startsAt: string | null;
  endsAt: string | null;
}

/**
 * A way of counting matches. `all` is the Quick Match and Competitive blend, the default; every other
 * id counts one game mode on its own.
 */
export type HeroStatsModeId = 'all' | 'quick-match' | 'competitive' | 'arcade' | 'practice';

/** One mode a client can ask for, with how many matches it holds in the half-season shown. */
export interface HeroStatsMode {
  id: HeroStatsModeId;
  label: string;
  /** Matches with a win or a loss in this mode: what `matchesCounted` is while the mode is selected. */
  decidedMatches: number;
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
  /** Every half-season that has started, oldest first: the seasons a client can ask for. */
  halfSeasons: HeroStatsHalfSeason[];
  /** The half-season the numbers come from, or null before any half-season exists. */
  halfSeason: HeroStatsHalfSeason | null;
  /**
   * Set only when `halfSeason` is the previous half-season, shown while this current one is still
   * below the minimum.
   */
  inPlaceOf: HeroStatsHalfSeason | null;
  /**
   * The mode the numbers count, or null when the request named a mode that does not exist (then
   * nothing is counted). Absent only in an answer the CDN cached before this field existed.
   */
  mode?: HeroStatsModeId | null;
  /** Every mode a client can ask for, in display order, counted in the half-season shown. Absent when `mode` is. */
  modes?: HeroStatsMode[];
  /** Matches with a win or a loss in the selected mode: the pick rate's denominator. */
  matchesCounted: number;
  tiers: HeroStatsTier[];
  belowMinimum: HeroStatsBelowMinimum[];
}
