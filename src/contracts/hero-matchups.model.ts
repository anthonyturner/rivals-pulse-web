import type { HeroStatsHalfSeason } from './hero-stats.model.js';

/**
 * How one hero fares when an enemy plays another hero, from the matches Rivals Pulse players
 * recorded. It describes a record; it does not say who to pick or ban. Every rate is a percentage
 * from 0 to 100.
 */
export interface HeroMatchup {
  /** The hero whose record this is, as its id in `heroes.json`. */
  hero: string;
  /** The hero on the other team. */
  enemy: string;
  /** Matches with a win or a loss in which `hero` faced `enemy`. */
  matches: number;
  /** `hero`'s scoreboard lines in those matches: what `wins` and the rates are counted over. */
  appearances: number;
  wins: number;
  winRate: number;
  /** The win rate pulled toward 50%, so a short run cannot read as a clear edge. */
  shrunkWinRate: number;
}

/**
 * Every hero-against-hero record the site shows, from Rivals Pulse overlay matches only.
 *
 * `ready` means at least one matchup has reached `minimumMatches`; `not-enough-data` is a designed
 * state, not an error, and then `matchups` is empty. Matchups below the minimum are never listed.
 * The list is sorted by hero, then enemy, which is not a ranking.
 */
export interface HeroMatchups {
  status: 'ready' | 'not-enough-data';
  minimumMatches: number;
  /** The half-season the numbers come from, or null before any half-season exists. */
  halfSeason: HeroStatsHalfSeason | null;
  /**
   * Set only when `halfSeason` is the previous half-season, shown while the current one has no
   * matchup at the minimum.
   */
  inPlaceOf: HeroStatsHalfSeason | null;
  matchups: HeroMatchup[];
}
