import type { HeroStatsHalfSeason } from './hero-stats.model.js';

/*
 * Nothing in this payload is an exact count of matches. A hidden bucket (a map, a mode or a day with
 * too few recorders) could otherwise be worked out by subtracting the shown ones from a total, so the
 * tab gets whole-number percentages, minutes, and one coarse volume band instead.
 */

/** One map's record in Competitive and Quick Match. */
export interface CommunityMapRecord {
  map: string;
  /** Wins as a whole percentage from 0 to 100 of the matches with a known result. */
  winRate: number;
}

/** One game mode's share of the matches whose mode the game reported. */
export interface CommunityModeShare {
  /** The mode's id as the game numbers it, such as 0 for Quick Match. */
  playModeId: number;
  mode: string;
  /** Whole percentage from 1 to 100 of the matches in the mix. */
  share: number;
  /** Rounded to the minute; null when too few of this mode's matches carried a length. */
  averageLengthMinutes: number | null;
}

export interface CommunityDayCount {
  /** A UTC calendar day, such as `2026-10-29`. */
  day: string;
  /** Whole percentage from 1 to 100 of the matches on the days shown. */
  share: number;
}

/** The sample each section needs before it shows a figure. These are rules, not counts of data. */
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
  /**
   * The matches behind the figures as a floor, such as 100 for "100+ matches" (see
   * `MATCH_VOLUME_BANDS`), or null below the smallest band.
   */
  matchesBand: number | null;
  maps: CommunityMapRecord[];
  /** Maps with a result but under the minimum: named, never counted. */
  mapsBelowMinimum: string[];
  modeMix: CommunityModeShare[] | null;
  averageLengthMinutes: number | null;
  perDay: CommunityDayCount[] | null;
}
