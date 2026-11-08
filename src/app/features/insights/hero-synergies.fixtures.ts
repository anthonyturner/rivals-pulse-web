import type { HeroSynergies, HeroSynergy } from '../../../contracts/hero-synergies.model';
import { season } from './hero-matchup.fixtures';

/** Fixtures the team-comps specs share; nothing imports this outside a spec. */

/** `hero` and `ally` won `wins` of `matches` matches together; the shrunk rate is worked out as the server does. */
export function synergy(hero: string, ally: string, wins: number, matches: number): HeroSynergy {
  return {
    hero,
    ally,
    matches,
    appearances: matches,
    wins,
    winRate: (wins / matches) * 100,
    shrunkWinRate: ((wins + 5) / (matches + 10)) * 100,
  };
}

export function synergiesOf(list: HeroSynergy[], overrides: Partial<HeroSynergies> = {}): HeroSynergies {
  return {
    status: list.length > 0 ? 'ready' : 'not-enough-data',
    minimumMatches: 10,
    halfSeason: season(10.5),
    inPlaceOf: null,
    synergies: list,
    ...overrides,
  };
}
