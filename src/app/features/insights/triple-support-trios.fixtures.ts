import type { TripleSupportTrio, TripleSupportTrios } from '../../../contracts/triple-support-trios.model';
import { season } from './hero-matchup.fixtures';
import { MODES } from './hero-synergies.fixtures';

/** Fixtures the team-comps specs share; nothing imports this outside a spec. */

/** A trio of `heroes` (ids in `heroes.json`) named for `label`; `teams` is the matches, and `share` that many of 200 teams. */
export function trio(
  heroes: [string, string, string],
  label: string,
  matches: number,
  wins: number,
  extra: Partial<TripleSupportTrio> = {},
): TripleSupportTrio {
  return {
    heroIds: [1, 2, 3],
    heroes,
    variant: { label, anchorHeroIds: [] },
    matches,
    teams: matches,
    wins,
    share: Math.round((matches / 200) * 10_000) / 10_000,
    ...extra,
  };
}

export function triosOf(list: TripleSupportTrio[], overrides: Partial<TripleSupportTrios> = {}): TripleSupportTrios {
  return {
    status: list.length > 0 ? 'ready' : 'not-enough-data',
    minimumMatches: 10,
    halfSeason: season(10.5),
    inPlaceOf: null,
    halfSeasons: [season(10), season(10.5)],
    mode: 'competitive',
    modes: MODES,
    classifiedTeams: list.length > 0 ? 200 : 0,
    unclassifiedTeams: 0,
    fourPlusTeams: list.length > 0 ? 6 : 0,
    trios: list,
    ...overrides,
  };
}
