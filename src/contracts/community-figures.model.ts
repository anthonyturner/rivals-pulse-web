import type { HeroStatsHalfSeason, HeroStatsModeId } from './hero-stats.model.js';
import type { HeroRole } from './role-stats.model.js';

/*
 * Nothing in this payload is a sum, a count of lines or a count of players. A figure is a rate
 * rounded to a whole number, and a figure that is not shown is null. The database has already left
 * out every hero that too few players (or one player mostly) recorded, so a total here would hide
 * what it leaves out; only the rounded rate leaves the server.
 */

/**
 * Damage, healing and damage blocked per minute played, rounded to whole numbers. Each is null when
 * too few lines carry that figure, which is also what an older app's missing figure looks like.
 */
export interface CommunityPerMinute {
  damage: number | null;
  healing: number | null;
  blocked: number | null;
}

export interface CommunityRoleFigures extends CommunityPerMinute {
  role: HeroRole;
}

export interface CommunityHeroFigures extends CommunityPerMinute {
  /** The hero's id in `heroes.json`, such as `captain-america`. */
  hero: string;
}

export interface CommunityFiguresMode {
  id: HeroStatsModeId;
  label: string;
  /** Always every role, in the order of `HERO_ROLES`. */
  roles: CommunityRoleFigures[];
  /** Only heroes with at least one figure to show, in hero id order. */
  heroes: CommunityHeroFigures[];
}

/** The lines a figure needs before it is shown. These are rules, not counts of data. */
export interface CommunityFiguresMinimums {
  /** Lines that carry a figure and the time played before a role shows that figure. */
  roleLines: number;
  /** The same for one hero. */
  heroLines: number;
  /**
   * Distinct players who must have recorded a hero's lines before they count. The database applies
   * this (with a cap of half the lines for any one player); it is here so a tab can say so.
   */
  recorders: number;
}

/**
 * The per-minute figures of the Community Stats and Heroes tabs, from Rivals Pulse overlay uploads
 * only. These are what recorders did with a hero, not the whole lobby, and a recorder's client only
 * knows its own player's figures.
 *
 * `ready` means at least one role or hero has a figure to show; `not-enough-data` is a designed
 * state, not an error.
 */
export interface CommunityFigures {
  status: 'ready' | 'not-enough-data';
  minimums: CommunityFiguresMinimums;
  /** Every half-season that has started, oldest first: the seasons a client can ask for. */
  halfSeasons: HeroStatsHalfSeason[];
  /** The half-season the numbers come from, or null before any half-season exists. */
  halfSeason: HeroStatsHalfSeason | null;
  /** Set only when `halfSeason` is the previous half-season, shown while the current one has no figure. */
  inPlaceOf: HeroStatsHalfSeason | null;
  /** Always every mode, in the order `all`, `quick-match`, `competitive`, `arcade`, `practice`. */
  modes: CommunityFiguresMode[];
}
