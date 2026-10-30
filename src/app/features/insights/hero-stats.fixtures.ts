import type { HeroStats, HeroStatsHero } from '../../../contracts/hero-stats.model';
import type { TierName } from '../../../contracts/tier-list.model';
import { season } from './hero-matchup.fixtures';

/** Fixtures the hero-stats specs share; nothing imports this outside a spec. */
export { season };

/** A placed hero: `wins` of `appearances` lines, picked in `pickRate`% of the matches counted. */
export function statsHero(
  hero: string,
  appearances: number,
  wins: number,
  pickRate: number,
  tier: TierName = 'B',
): HeroStatsHero {
  return {
    hero,
    appearances,
    wins,
    winRate: (wins / appearances) * 100,
    pickRate,
    shrunkWinRate: ((wins + 5) / (appearances + 10)) * 100,
    tier,
    kda: null,
    finalHitsAverage: null,
  };
}

export function statsOf(tiers: HeroStats['tiers'], overrides: Partial<HeroStats> = {}): HeroStats {
  return {
    status: tiers.some((tier) => tier.heroes.length > 0) ? 'ready' : 'not-enough-data',
    minimumMatches: 10,
    halfSeasons: [season(10.5)],
    halfSeason: season(10.5),
    inPlaceOf: null,
    matchesCounted: 149,
    tiers,
    belowMinimum: [],
    ...overrides,
  };
}
