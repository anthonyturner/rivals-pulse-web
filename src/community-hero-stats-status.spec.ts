import { communityHeroStatsStatus } from './community-hero-stats-status';
import type { HeroStats, HeroStatsHalfSeason, HeroStatsHero } from './contracts/hero-stats.model';

const current: HeroStatsHalfSeason = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };
const previous: HeroStatsHalfSeason = {
  id: 10,
  label: 'Season 10',
  startsAt: '2026-09-11T09:00:00Z',
  endsAt: current.startsAt,
};

const hero = (slug: string): HeroStatsHero => ({
  hero: slug,
  appearances: 12,
  wins: 6,
  winRate: 50,
  pickRate: 8,
  shrunkWinRate: 50,
  tier: 'C',
  kda: null,
  finalHitsAverage: null,
});

const notEnough: HeroStats = {
  status: 'not-enough-data',
  minimumMatches: 10,
  halfSeasons: [],
  halfSeason: null,
  inPlaceOf: null,
  matchesCounted: 0,
  tiers: [],
  belowMinimum: [],
};

describe('communityHeroStatsStatus', () => {
  it('counts the heroes placed across every tier', () => {
    const status = communityHeroStatsStatus({
      ...notEnough,
      status: 'ready',
      halfSeason: current,
      matchesCounted: 146,
      tiers: [
        { name: 'A', heroes: [hero('storm'), hero('hela')] },
        { name: 'C', heroes: [hero('thor')] },
      ],
    });

    expect(status).toEqual({ status: 'ready', halfSeason: 10.5, inPlaceOf: null, matchesCounted: 146, heroesPlaced: 3 });
  });

  it('reports the previous half-season standing in for the current one', () => {
    const status = communityHeroStatsStatus({ ...notEnough, halfSeason: previous, inPlaceOf: current });

    expect(status.halfSeason).toBe(10);
    expect(status.inPlaceOf).toBe(10.5);
  });

  it('answers zeros and nulls, not NaN, when there is no data at all', () => {
    expect(communityHeroStatsStatus(notEnough)).toEqual({
      status: 'not-enough-data',
      halfSeason: null,
      inPlaceOf: null,
      matchesCounted: 0,
      heroesPlaced: 0,
    });
  });
});
