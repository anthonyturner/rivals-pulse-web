import type { HeroMatchups } from '../../../contracts/hero-matchups.model';

/** What to show in place of matchup records while there are none to show. */
export interface MatchupNotice {
  kind: 'loading' | 'error' | 'empty';
  heading: string | null;
  message: string;
}

/**
 * The notice for the matchup records: `undefined` while they load, `null` when they could not be
 * read. Returns null once there are records to show.
 */
export function matchupNotice(matchups: HeroMatchups | null | undefined): MatchupNotice | null {
  if (matchups === undefined) {
    return { kind: 'loading', heading: null, message: 'Loading matchups…' };
  }

  if (matchups === null) {
    return {
      kind: 'error',
      heading: 'Matchups unavailable',
      message: 'RivalsPulse player matchups cannot be loaded right now. The hero list still works.',
    };
  }

  if (matchups.matchups.length === 0) {
    return {
      kind: 'empty',
      heading: 'Not enough data yet',
      message: `No two heroes have faced each other in ${matchups.minimumMatches} recorded matches yet. Matchups appear here as RivalsPulse players record more matches.`,
    };
  }

  return null;
}
