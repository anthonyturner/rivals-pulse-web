import type { HeroSwitchIn, HeroSwitchIns, HeroSwitchInOverall } from '../../../contracts/hero-switch-ins.model';
import { season } from './hero-matchup.fixtures';

/** Fixtures the switch-in specs share; nothing imports this outside a spec. */

/** A record against the enemy over every match, with the rate worked out as the server does. */
export function overallOf(wins: number, appearances: number): HeroSwitchInOverall {
  return { matches: appearances, appearances, wins, winRate: (wins / appearances) * 100 };
}

/** `hero` was switched to `switches` times (in as many matches) while `enemy` was on the field, `wins` of them won. */
export function switchIn(
  hero: string,
  enemy: string,
  wins: number,
  switches: number,
  overall: HeroSwitchInOverall | null = null,
): HeroSwitchIn {
  return { hero, enemy, matches: switches, switches, wins, winRate: (wins / switches) * 100, overall };
}

export function switchInsOf(list: HeroSwitchIn[], overrides: Partial<HeroSwitchIns> = {}): HeroSwitchIns {
  return {
    status: list.length > 0 ? 'ready' : 'not-enough-data',
    minimumMatches: 10,
    minimumPlayers: 2,
    halfSeason: season(10.5),
    inPlaceOf: null,
    switchIns: list,
    ...overrides,
  };
}
