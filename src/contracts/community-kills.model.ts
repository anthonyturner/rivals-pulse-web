import type { HeroStatsHalfSeason } from './hero-stats.model.js';

/*
 * The kill feed is what a recorder's own client saw, so these are seen kills, not every kill. No
 * exact count leaves the server: a pair carries the volume band of its seen kills (such as 25 for
 * "25+"), and the database has already left out every pair that too few players recorded.
 */

/** How often one hero killed another in the feeds recorders saw. */
export interface CommunityKillPair {
  /** The killing hero's id in `heroes.json`. */
  killer: string;
  /** The hero that was killed. */
  victim: string;
  /** The largest band the pair's seen kills reach, as the floor in "25+ seen kills". */
  killsBand: number;
}

/** The sample a pair needs before it is shown. These are rules, not counts of data. */
export interface CommunityKillsMinimums {
  /** Matches whose feed had the pair before it is listed. */
  pairMatches: number;
  /** Distinct players who must have recorded a pair's matches; the database applies it. */
  recorders: number;
}

/**
 * The kill-feed counters. Each hero's best pairs as killer and as victim are listed (see
 * `KILL_FEED_PAIRS_PER_HERO`), most seen kills first; any other pair is left out of the payload.
 * A pair in a list may rank below one the database hid, so a list is "the most seen among the pairs
 * enough players recorded".
 *
 * `ready` means at least one pair is listed; `not-enough-data` is a designed state, not an error.
 */
export interface CommunityKills {
  status: 'ready' | 'not-enough-data';
  minimums: CommunityKillsMinimums;
  halfSeasons: HeroStatsHalfSeason[];
  halfSeason: HeroStatsHalfSeason | null;
  inPlaceOf: HeroStatsHalfSeason | null;
  /** Most seen kills first, then by killer and victim id. */
  pairs: CommunityKillPair[];
}
