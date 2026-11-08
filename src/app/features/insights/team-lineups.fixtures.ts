import type { TeamLineupShape, TeamLineups } from '../../../contracts/team-lineups.model';
import { season } from './hero-matchup.fixtures';
import { MODES } from './hero-synergies.fixtures';

/** Fixtures the team-comps specs share; nothing imports this outside a spec. */

/** A shape that `teams` teams ran and `wins` of them won, out of 1000 classified teams. */
export function lineupShape(vanguards: number, duelists: number, strategists: number, teams: number, wins: number): TeamLineupShape {
  return {
    shape: `${vanguards}-${duelists}-${strategists}`,
    vanguards,
    duelists,
    strategists,
    status: 'ready',
    teams,
    wins,
    pickRate: Math.round((teams / 1000) * 10_000) / 10_000,
    winRate: Math.round((wins / teams) * 10_000) / 10_000,
  };
}

/** A shape under the minimum: listed, with no figures. */
export function thinShape(vanguards: number, duelists: number, strategists: number): TeamLineupShape {
  return {
    shape: `${vanguards}-${duelists}-${strategists}`,
    vanguards,
    duelists,
    strategists,
    status: 'not-enough-data',
    teams: null,
    wins: null,
    pickRate: null,
    winRate: null,
  };
}

export function lineupsOf(list: TeamLineupShape[], overrides: Partial<TeamLineups> = {}): TeamLineups {
  return {
    status: list.some(({ status }) => status === 'ready') ? 'ready' : 'not-enough-data',
    minimumTeams: 50,
    halfSeason: season(10.5),
    inPlaceOf: null,
    halfSeasons: [season(10), season(10.5)],
    mode: 'competitive',
    modes: MODES,
    classifiedTeams: 1000,
    unclassifiedTeams: 0,
    shapes: list,
    ...overrides,
  };
}
