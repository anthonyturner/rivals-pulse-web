import type { HeroStatsHalfSeason } from './hero-stats.model.ts';

/**
 * One team line-up shape: how many Vanguards, Duelists and Strategists one team ran at the end of a
 * match, such as 1-2-3 (shown in that order), and how teams with that shape fared.
 *
 * `not-enough-data` means fewer teams than `minimumTeams` ran the shape this half-season; the shape
 * is listed and its figures are null.
 */
export interface TeamLineupShape {
  /** The shape as "Vanguards-Duelists-Strategists", such as "1-2-3". */
  shape: string;
  vanguards: number;
  duelists: number;
  strategists: number;
  status: 'ready' | 'not-enough-data';
  /** Teams that ran this shape in matches with a win or a loss; a mirror match counts both teams. Null while not enough data. */
  teams: number | null;
  /** The teams that won. Null while not enough data. */
  wins: number | null;
  /** `teams` over `classifiedTeams`, from 0 to 1, to four decimals. Null while not enough data. */
  pickRate: number | null;
  /** `wins` over `teams`, from 0 to 1, to four decimals. Null while not enough data. */
  winRate: number | null;
}

/**
 * The team line-ups in Competitive matches from RivalsPulse app matches only. No player and no hero
 * is named.
 *
 * `ready` means at least one shape reached `minimumTeams`; `not-enough-data` is a designed state, not
 * an error. A team with a hero no role is known for (no hero recorded, an unknown id) is counted in
 * `unclassifiedTeams`, never in a shape. The team counts describe the half-season shown.
 */
export interface TeamLineups {
  status: 'ready' | 'not-enough-data';
  minimumTeams: number;
  /** The half-season the counts come from, or null before any half-season exists. */
  halfSeason: HeroStatsHalfSeason | null;
  /** Set only when `halfSeason` is the previous one, shown while the current one has no shape at the minimum. */
  inPlaceOf: HeroStatsHalfSeason | null;
  /** Teams in matches with a win or a loss whose heroes all have a known role: the denominator of `pickRate`. */
  classifiedTeams: number;
  /** Teams in those matches with a hero no role is known for. */
  unclassifiedTeams: number;
  /** Shapes at the minimum first, most played first, then shapes under it. */
  shapes: TeamLineupShape[];
}
