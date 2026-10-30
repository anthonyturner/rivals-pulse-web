import type { HeroStatsHalfSeason } from './hero-stats.model.js';

/** One map's record in Competitive and Quick Match. Rates are percentages from 0 to 100. */
export interface CommunityMapRecord {
  map: string;
  /** Matches on this map with a known win or loss from the recorder's side. */
  matches: number;
  wins: number;
  winRate: number;
}

/** A map that has results but too few to show a rate yet. */
export interface CommunityMapBelowMinimum {
  map: string;
  matches: number;
}

/** One game mode's share of the matches whose mode the game reported. */
export interface CommunityModeShare {
  /** The mode's id as the game numbers it, such as 0 for Quick Match. */
  playModeId: number;
  mode: string;
  matches: number;
  /** Percentage from 0 to 100 of the matches counted in the mix. */
  share: number;
  /** Null when too few of this mode's matches carried a length. */
  averageLengthSeconds: number | null;
}

export interface CommunityDayCount {
  /** A UTC calendar day, such as `2026-10-29`. */
  day: string;
  matches: number;
}

/** The sample each section needs before it shows a figure. */
export interface CommunityMatchesMinimums {
  /** Matches in the half-season before the mode mix and matches per day show. */
  overviewMatches: number;
  /** Matches with a win or a loss on one map before its win rate shows. */
  mapMatches: number;
  /** Matches with a known length before an average length shows. */
  lengthMatches: number;
  /**
   * Distinct players who must have recorded the matches of a map, mode or day before it shows. The
   * database applies this (with a cap of half a bucket for any one player); it is here so the tab can say so.
   */
  recorders: number;
}

/**
 * The Community Matches tab: win rate by map, the mode mix, average match length and matches per day,
 * all counted once per match and anonymous.
 *
 * `ready` means at least one section has a figure to show; `not-enough-data` is a designed state,
 * not an error. A section that is below its minimum is empty (`maps`) or null (the others).
 */
export interface CommunityMatches {
  status: 'ready' | 'not-enough-data';
  minimums: CommunityMatchesMinimums;
  /** Every half-season that has started, oldest first: the seasons a client can ask for. */
  halfSeasons: HeroStatsHalfSeason[];
  /** The half-season the numbers come from, or null before any half-season exists. */
  halfSeason: HeroStatsHalfSeason | null;
  /** Set only when `halfSeason` is the previous half-season, shown while the current one is below the minimum. */
  inPlaceOf: HeroStatsHalfSeason | null;
  /** Every distinct match in the half-season, whatever its mode, map or result. */
  matchesCounted: number;
  maps: CommunityMapRecord[];
  mapsBelowMinimum: CommunityMapBelowMinimum[];
  modeMix: CommunityModeShare[] | null;
  averageLengthSeconds: number | null;
  perDay: CommunityDayCount[] | null;
}
