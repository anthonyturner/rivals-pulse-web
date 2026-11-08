import type { HeroStatsHalfSeason } from './hero-stats.model.ts';

/**
 * How a pair of heroes fares when one team holds both, from the matches RivalsPulse players
 * recorded. It describes a record; it does not say who to pick. Every rate is a percentage from 0
 * to 100.
 */
export interface HeroSynergy {
  /** The first hero of the pair, as its id in `heroes.json`. */
  hero: string;
  /** The other hero of the pair. A pair is listed once, in either order. */
  ally: string;
  /** Matches with a win or a loss in which a team held both. */
  matches: number;
  /** Team occurrences of the pair in those matches: a match where both teams held it counts twice. */
  appearances: number;
  wins: number;
  winRate: number;
  /** The win rate pulled toward 50%, so a short run cannot read as a clear edge. */
  shrunkWinRate: number;
}

/**
 * Every hero-with-hero record the site shows, from RivalsPulse app matches only, in the Quick Match
 * and Competitive blend and all ranks together.
 *
 * `ready` means at least one pair has reached `minimumMatches`; `not-enough-data` is a designed
 * state, not an error, and then `synergies` is empty. Pairs below the minimum are never listed.
 * The list is sorted by hero, then ally, which is not a ranking.
 */
export interface HeroSynergies {
  status: 'ready' | 'not-enough-data';
  minimumMatches: number;
  /** The half-season the numbers come from, or null before any half-season exists. */
  halfSeason: HeroStatsHalfSeason | null;
  /** Set only when `halfSeason` is the previous half-season, shown while the current one has no pair at the minimum. */
  inPlaceOf: HeroStatsHalfSeason | null;
  synergies: HeroSynergy[];
}
