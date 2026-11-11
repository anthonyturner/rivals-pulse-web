import type { HeroStatsHalfSeason } from './hero-stats.model.ts';

/**
 * How many matches stand behind a bucket, rounded down to a step, so the figures say how much they rest
 * on without publishing an exact count.
 */
export type HeroSpecialistsMatchesBand = '50+' | '100+' | '250+' | '500+';

/** One bucket of players on one hero. Every rate is a percentage from 0 to 100, to one decimal. */
export interface HeroSpecialistsBucket {
  /** Wins over matches of the bucket on this hero. */
  winRate: number;
  /**
   * `winRate` pulled toward the hero's own win rate, with the strength the hero stats estimate from
   * every hero's record, so a short bucket does not read as the whole truth.
   */
  shrunkWinRate: number;
  matchesBand: HeroSpecialistsMatchesBand;
}

/** The rule that sorts people into the two buckets, as fractions of a person's counted matches. */
export interface HeroSpecialistsDefinition {
  /** A specialist on a hero played at least this share of their counted matches on it... */
  specialistMinShare: number;
  /** ...and at least this many matches on it. */
  specialistMinHeroMatches: number;
  /** A flex player's most played hero is under this share of their counted matches... */
  flexMaxTopShare: number;
  /** ...they played at least this many heroes... */
  flexMinHeroes: number;
  /** ...and have at least this many counted matches. */
  flexMinMatches: number;
}

/**
 * One hero. `ready` means both buckets passed the minimums, and only then are `specialist` and `flex`
 * present. `not-enough-data` carries no figure and no progress count: a count of how close a bucket is
 * would let a reader work out who is in it.
 */
export interface HeroSpecialistsHero {
  /** The hero's id in `heroes.json`. */
  hero: string;
  status: 'ready' | 'not-enough-data';
  specialist?: HeroSpecialistsBucket;
  flex?: HeroSpecialistsBucket;
}

/**
 * Specialists against flex players, pooled per hero from the matches RivalsPulse players recorded, as
 * players identified by their in-game uid (never named). It describes a record; it does not say who is
 * better. Counted matches are Quick Match and Competitive with a win or a loss.
 *
 * `ready` means at least one hero has both buckets; `not-enough-data` is a designed state, not an
 * error. A hero that has matches but no bucket pair is listed as `not-enough-data`.
 */
export interface HeroSpecialists {
  status: 'ready' | 'not-enough-data';
  definition: HeroSpecialistsDefinition;
  /** Matches each bucket of a hero needs. */
  minimumMatches: number;
  /** Different players each bucket of a hero needs. */
  minimumPlayers: number;
  /** The half-season the numbers come from, or null before any half-season exists. */
  halfSeason: HeroStatsHalfSeason | null;
  /** Set only when `halfSeason` is the previous half-season, shown while the current one has no hero. */
  inPlaceOf: HeroStatsHalfSeason | null;
  /** Every hero with a counted match in `halfSeason`, by hero id. */
  heroes: HeroSpecialistsHero[];
}
