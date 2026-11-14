import type { HeroStatsMode } from '../../../contracts/hero-stats.model';
import type { HeroSynergies, HeroSynergy } from '../../../contracts/hero-synergies.model';
import { season } from './hero-matchup.fixtures';

/** Fixtures the team-comps specs share; nothing imports this outside a spec. */

/** The modes an answer offers when a spec does not care: the blend, Quick Match and Competitive have matches. */
export const MODES: HeroStatsMode[] = [
  { id: 'all', label: 'Quick Match and Competitive', decidedMatches: 120 },
  { id: 'quick-match', label: 'Quick Match', decidedMatches: 40 },
  { id: 'competitive', label: 'Competitive', decidedMatches: 80 },
  { id: 'arcade', label: 'Arcade', decidedMatches: 0 },
  { id: 'practice', label: 'Practice', decidedMatches: 0 },
];

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
    halfSeasons: [season(10), season(10.5)],
    mode: 'competitive',
    modes: MODES,
    synergies: list,
    ...overrides,
  };
}
