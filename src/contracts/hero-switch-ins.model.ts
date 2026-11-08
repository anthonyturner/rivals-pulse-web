import type { HeroStatsHalfSeason } from './hero-stats.model.ts';

/** A hero's overall record against one enemy hero, as `HeroMatchup` states it. Every rate is a percentage from 0 to 100. */
export interface HeroSwitchInOverall {
  /** Matches with a win or a loss in which the hero faced the enemy hero. */
  matches: number;
  /** The hero's scoreboard lines in those matches: what `wins` and `winRate` are counted over. */
  appearances: number;
  wins: number;
  winRate: number;
}

/**
 * How often a team won after one of its players switched to `hero` while a player on the other team
 * was on `enemy`, from the matches RivalsPulse players recorded. It describes a record; it does not
 * say what to switch to. Every rate is a percentage from 0 to 100.
 */
export interface HeroSwitchIn {
  /** The hero switched to, as its id in `heroes.json`. */
  hero: string;
  /** The enemy hero that was on the field at the moment of the switch. */
  enemy: string;
  /** Matches with a win or a loss in which a switch to `hero` met `enemy`. */
  matches: number;
  /** The switches counted. One switch faced with two enemy heroes is one switch for each. */
  switches: number;
  /** Switches after which the switching player's team won. */
  wins: number;
  winRate: number;
  /**
   * `hero`'s record against `enemy` over every match, for comparison: players switch more when they
   * are losing, so a switch-in rate runs low against it. Null where that pair has too few matches.
   */
  overall: HeroSwitchInOverall | null;
}

/**
 * Every switch-in the site shows, from RivalsPulse app matches only.
 *
 * `ready` means at least one pairing has reached the minimums; `not-enough-data` is a designed state,
 * not an error, and then `switchIns` is empty. A pairing under either minimum is never listed. The
 * list is sorted by hero, then enemy, which is not a ranking.
 */
export interface HeroSwitchIns {
  status: 'ready' | 'not-enough-data';
  /** Matches a pairing needs in the half-season and mode. */
  minimumMatches: number;
  /** Different players who must have recorded those matches. */
  minimumPlayers: number;
  /** The half-season the numbers come from, or null before any half-season exists. */
  halfSeason: HeroStatsHalfSeason | null;
  /** Set only when `halfSeason` is the previous half-season, shown while the current one has no pairing. */
  inPlaceOf: HeroStatsHalfSeason | null;
  switchIns: HeroSwitchIn[];
}
