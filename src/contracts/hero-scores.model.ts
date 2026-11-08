import type { HeroStatsHalfSeason } from './hero-stats.model.js';

/** Measured comes straight from the game's figures. Estimated counts that an ability was used, not whether it landed. */
export type HeroScoreLabel = 'measured' | 'estimated';

export type HeroScoreStatus =
  /** Has a score. */
  | 'scored'
  /** Below the qualifying rule; `matches`, `contributors` and `oneContributorAboveHalf` say how far along. */
  | 'collecting'
  /** Passes the rule, but too few heroes do for a ranking to mean anything yet. */
  | 'ranking-too-small'
  /** Utility only: the hero has no ability that is tagged Utility and prints a plain cooldown. */
  | 'no-measurable-ability';

export interface HeroScoreStat {
  status: HeroScoreStatus;
  /** A whole number from 1 to 10, present only when `status` is `scored`. */
  score: number | null;
  label: HeroScoreLabel;
  /**
   * The hero's lines (one player on one hero in one match) behind the score. While `collecting`, how
   * many so far, rounded down to a multiple of 5, because an exact count could be one person's own games.
   */
  matches: number;
  /** Different players so far, only while `collecting`. */
  contributors: number | null;
  /**
   * While `collecting`, whether one player holds more than `minimums.busiestContributorShare` of the
   * lines, which holds the hero back. Always false when that share is 1 (no limit). The name is kept from
   * when the limit was half.
   */
  oneContributorAboveHalf: boolean | null;
  /** The figures behind the score, by name. Null until the hero passes the rule. */
  measures: Record<string, number> | null;
}

/** One ability slot the hero has, once that slot passes the rule on its own. */
export interface HeroScoreAbility {
  /** `ability_0` Right Click, `ability_1` Shift, `ability_2` E, `ability_3` F, `team_up_0` C, or `ultimate`. */
  slot: string;
  /** Null when the slot holds several abilities (a team-up, a form or an upgrade). */
  ability: string | null;
  /** Null when untagged or, for the ultimate, not tagged at all. */
  tag: 'Utility' | 'Damage' | 'Mobility' | 'Sustain' | null;
  usesPerTenMinutes: number;
  /** Kills and assists soon after a use, per use. Null when the app did not count them. */
  takedownsPerUse: number | null;
  matches: number;
}

export interface HeroScores {
  /** The hero's id in `heroes.json`, such as `captain-america`. */
  hero: string;
  damage: HeroScoreStat;
  sustain: HeroScoreStat;
  ultimate: HeroScoreStat;
  utility: HeroScoreStat;
  abilities: HeroScoreAbility[];
}

export interface HeroScoreMinimums {
  /** Lines needed in one half-season and mode. */
  matches: number;
  /** Different players needed in one half-season and mode. */
  contributors: number;
  /** No one player may hold more than this share of the lines. */
  busiestContributorShare: number;
  /** Heroes that must pass the rule before a stat is ranked at all. */
  rankedHeroes: number;
}

/**
 * The 1 to 10 hero build scores, from RivalsPulse overlay uploads in Quick Match and Competitive only.
 * A hero with no line at all in the half-season has no entry, which reads as 0 of each minimum.
 * `ready` means at least one hero has a score; `not-enough-data` is a designed state, not an error.
 */
export interface CommunityHeroScores {
  status: 'ready' | 'not-enough-data';
  minimums: HeroScoreMinimums;
  /** Every half-season that has started, oldest first: the seasons a client can ask for. */
  halfSeasons: HeroStatsHalfSeason[];
  /** The half-season the numbers come from, or null before any half-season exists. */
  halfSeason: HeroStatsHalfSeason | null;
  /** Set only when `halfSeason` is the previous half-season, shown while the current one has no score. */
  inPlaceOf: HeroStatsHalfSeason | null;
  /** In hero id order. */
  heroes: HeroScores[];
}
