import type { HeroMatchup, HeroMatchups } from '../../../contracts/hero-matchups.model';
import type { HeroStatsHalfSeason } from '../../../contracts/hero-stats.model';
import type { Hero, HeroRole } from '../heroes/hero.model';

/** Fixtures the matchup specs share; nothing imports this outside a spec. */
export const season = (id: number): HeroStatsHalfSeason => ({ id, label: `Season ${id}`, startsAt: null, endsAt: null });

/**
 * `hero` won `wins` of `appearances` lines against `enemy`, a hero whose usual shrunk rate is 50%; the
 * shrunk rate is worked out as the server does, and the pair is a counter when it is above even.
 * The scoreboard figures are not recorded unless `figures` gives them, and `extra` overrides any field.
 */
export function matchup(
  hero: string,
  enemy: string,
  wins: number,
  appearances: number,
  extra: Partial<Pick<HeroMatchup, 'kda' | 'finalHitsAverage' | 'edge' | 'isCounter'>> = {},
): HeroMatchup {
  const shrunkWinRate = ((wins + 5) / (appearances + 10)) * 100;

  return {
    hero,
    enemy,
    matches: appearances,
    appearances,
    wins,
    winRate: (wins / appearances) * 100,
    shrunkWinRate,
    edge: shrunkWinRate - 50,
    isCounter: shrunkWinRate > 50,
    kda: null,
    finalHitsAverage: null,
    ...extra,
  };
}

export function matchupsOf(list: HeroMatchup[], overrides: Partial<HeroMatchups> = {}): HeroMatchups {
  return {
    status: list.length > 0 ? 'ready' : 'not-enough-data',
    minimumMatches: 10,
    halfSeason: season(10.5),
    inPlaceOf: null,
    matchups: list,
    ...overrides,
  };
}

/** A roster hero with the old scraped `counters` list still filled in, which no page may read any more. */
export function heroOf(id: string, name: string, role: HeroRole): Hero {
  return {
    id,
    name,
    role,
    difficulty: 2,
    summary: '',
    playstyle: '',
    strengths: [],
    weaknesses: [],
    counters: ['Hulk'],
    synergies: [],
    abilities: [],
    imageUrl: `/images/heroes/${id}.png`,
  };
}
