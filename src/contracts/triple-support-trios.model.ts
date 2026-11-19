import type { HeroStatsHalfSeason, HeroStatsMode, HeroStatsModeId } from './hero-stats.model.ts';

/**
 * What a trio is called. A trio with utility Strategists (Mantis, Adam Warlock, Ultron) is named for
 * them: their display names in alphabetical order, joined with " + ", then " triple" ("Adam Warlock +
 * Mantis triple"). A trio with none is "Three healers".
 */
export interface TripleSupportVariant {
  label: string;
  /** The game hero ids of the utility heroes, in the order the label names them; empty for three healers. */
  anchorHeroIds: number[];
}

/** One trio of Strategists and how teams running exactly these three fared. */
export interface TripleSupportTrio {
  /** The three Strategists' game hero ids, ascending, with Deadpool's role forms under 1057. */
  heroIds: [number, number, number];
  /** The same three heroes by their id in `heroes.json`, in the order of `heroIds`, for pages that cannot map the game's ids. */
  heroes: [string, string, string];
  variant: TripleSupportVariant;
  /** Matches with a win or a loss in which a team ran exactly this trio. */
  matches: number;
  /** Team occurrences of the trio in those matches: a match where both teams ran it counts twice. */
  teams: number;
  /** The occurrences that won. */
  wins: number;
  /** `teams` over `classifiedTeams`, from 0 to 1, to four decimals. */
  share: number;
}

/**
 * The teams that ran exactly three Strategists in Quick Match and Competitive (or the one `mode`
 * asked for), from RivalsPulse app matches only. Counts only: a win rate is the reader's to compute from `wins` and `teams`.
 *
 * `ready` means at least one trio reached `minimumMatches`; `not-enough-data` is a designed state,
 * not an error, and then `trios` is empty. A trio below the minimum is never listed. The team counts
 * describe the same half-season as the trios and are 0 while no trio is listed.
 */
export interface TripleSupportTrios {
  status: 'ready' | 'not-enough-data';
  minimumMatches: number;
  /** The half-season the counts come from, or null before any half-season exists. */
  halfSeason: HeroStatsHalfSeason | null;
  /** Set only when `halfSeason` is the previous one, shown while the current one has no trio at the minimum. */
  inPlaceOf: HeroStatsHalfSeason | null;
  /** Every half-season that has started, oldest first: the seasons a client can ask for. Absent only in an answer the CDN cached before this field existed. */
  halfSeasons?: HeroStatsHalfSeason[];
  /** The mode the counts use, or null when the request named a mode that does not exist (then nothing is counted). Absent only in an answer the CDN cached before this field existed. */
  mode?: HeroStatsModeId | null;
  /** Every mode a client can ask for, counted in the half-season shown. Absent when `mode` is. */
  modes?: HeroStatsMode[];
  /** Teams in matches with a win or a loss whose heroes all have a known role: the denominator of `share`. */
  classifiedTeams: number;
  /** Teams in those matches with a hero no role is known for (no hero recorded, an unknown id): never counted as a trio. */
  unclassifiedTeams: number;
  /** Classified teams with four or more Strategists, called "Quad support". Counted as that shape only: they have no trio and their heroes are not stored. */
  fourPlusTeams: number;
  /** Most played first, then by hero ids. */
  trios: TripleSupportTrio[];
}
