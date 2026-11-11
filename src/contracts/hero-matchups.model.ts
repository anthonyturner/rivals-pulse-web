import type { HeroStatsHalfSeason } from './hero-stats.model.ts';

/**
 * How one hero fares when an enemy plays another hero, from the matches RivalsPulse players
 * recorded. It describes a record; it does not say who to pick or ban. Every rate is a percentage
 * from 0 to 100. The counts are the pair counts of `/api/hero-pairs`, so the overlay reads the same
 * ones.
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
  /**
   * The win rate pulled toward the average of all heroes by a prior estimated from the heroes' own
   * records, so a short run cannot read as a clear edge. The same rate the overlay compares.
   */
  shrunkWinRate: number;
  /** `shrunkWinRate` minus `hero`'s own shrunk win rate over every enemy, in percentage points. Negative when `hero` does worse than usual against `enemy`. */
  edge: number;
  /**
   * Whether `hero` counts as a counter to `enemy`: the pair's `edge` reaches the community rule's 3
   * points. The one answer every counter list on the site and the overlay's community counters gives.
   */
  isCounter: boolean;
  /**
   * (kills + assists) over deaths across `hero`'s lines while facing `enemy`, or null where those
   * were not recorded, including every half-season counted before the figures existed.
   */
  kda: number | null;
  /** Final hits per line while facing `enemy`; null on the same terms as `kda`. */
  finalHitsAverage: number | null;
}

/**
 * Every hero-against-hero record the site shows, from RivalsPulse app matches only.
 *
 * `ready` means at least one matchup has reached `minimumMatches`; `not-enough-data` is a designed
 * state, not an error, and then `matchups` is empty. Matchups below the minimum are never listed;
 * one at the minimum is listed whether or not it `isCounter`. The list is sorted by hero, then
 * enemy, which is not a ranking.
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

/**
 * The edge, in percentage points over a hero's own shrunk win rate, at which a pair counts as a
 * counter. The server applies it (`isCounter`) and the pages quote it in their wording, so both
 * read this one number.
 */
export const COUNTER_MIN_EDGE_POINTS = 3;
