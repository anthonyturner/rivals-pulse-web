import type { HeroStatsHalfSeason, HeroStatsModeId } from './hero-stats.model.js';

export const HERO_ROLES = ['Vanguard', 'Duelist', 'Strategist'] as const;

export type HeroRole = (typeof HERO_ROLES)[number];

/** The hero numbers' modes: `all` blends Quick Match and Competitive. */
export type RoleStatsModeId = HeroStatsModeId;

/**
 * What the community plays like in one role and mode. Every figure is per scoreboard line (one
 * player in one match), pooled across everyone, and is null when too few lines carry it.
 */
export interface RoleStatsRole {
  role: HeroRole;
  /**
   * Scoreboard lines of the role in matches with a win or a loss. A line is one player in one match,
   * so this is not a count of matches.
   */
  appearances: number;
  /** `ready` once `appearances` reaches the minimum; below it every figure is null. */
  status: 'ready' | 'not-enough-data';
  /** A percentage from 0 to 100. */
  winRate: number | null;
  killsAverage: number | null;
  deathsAverage: number | null;
  assistsAverage: number | null;
  /** (kills + assists) / deaths over all lines, with no deaths treated as one. */
  kda: number | null;
  /** Final hits per line; older apps do not send it, so it needs its own sample. */
  finalHitsAverage: number | null;
}

export interface RoleStatsMode {
  id: RoleStatsModeId;
  label: string;
  /** Always every role, in the order of `HERO_ROLES`. */
  roles: RoleStatsRole[];
}

/**
 * The Community Stats tab's numbers, from Rivals Pulse overlay matches only. `not-enough-data` is a
 * designed state, not an error: it means no role in any mode has reached `minimumLines`.
 */
export interface RoleStats {
  status: 'ready' | 'not-enough-data';
  /** Lines a role needs, in a mode, before its figures are shown. */
  minimumLines: number;
  /** Every half-season that has started, oldest first: the seasons a client can ask for. */
  halfSeasons: HeroStatsHalfSeason[];
  /** The half-season the numbers come from, or null before any half-season exists. */
  halfSeason: HeroStatsHalfSeason | null;
  /** Set only when `halfSeason` is the previous half-season, shown while the current one has no ready role. */
  inPlaceOf: HeroStatsHalfSeason | null;
  /** Always every mode, in the order `all`, `quick-match`, `competitive`, `arcade`, `practice`. */
  modes: RoleStatsMode[];
}
