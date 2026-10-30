import type { HeroStats, HeroStatsHalfSeason, HeroStatsHero } from '../../../../../contracts/hero-stats.model';
import type { HeroIdentities } from '../../../insights/hero-identity';
import { buildHeroUsageView, HERO_USAGE_SLOTS } from './hero-usage-view';

const current: HeroStatsHalfSeason = {
  id: 10.5,
  label: 'Season 10.5',
  startsAt: '2026-10-09T09:00:00Z',
  endsAt: null,
};
const previous: HeroStatsHalfSeason = {
  id: 10,
  label: 'Season 10',
  startsAt: '2026-09-11T09:00:00Z',
  endsAt: current.startsAt,
};

function hero(slug: string, appearances: number, pickRate: number): HeroStatsHero {
  return {
    hero: slug,
    appearances,
    wins: Math.floor(appearances / 2),
    winRate: 50,
    pickRate,
    shrunkWinRate: 50,
    tier: 'C',
    kda: null,
    finalHitsAverage: null,
  };
}

function statsOf(overrides: Partial<HeroStats> = {}): HeroStats {
  return {
    status: 'ready',
    minimumMatches: 10,
    halfSeasons: [current],
    halfSeason: current,
    inPlaceOf: null,
    matchesCounted: 146,
    tiers: [{ name: 'C', heroes: [hero('storm', 30, 20), hero('hela', 1800, 55), hero('thor', 12, 8)] }],
    belowMinimum: [],
    ...overrides,
  };
}

const identities: HeroIdentities = new Map([
  ['storm', { name: 'Storm', role: 'Duelist', imageUrl: '/images/heroes/storm.png' }],
]);

describe('buildHeroUsageView', () => {
  it('lists the most-picked heroes first, with finished labels', () => {
    const view = buildHeroUsageView(statsOf(), identities);

    expect(view.state).toBe('ready');
    expect(view.cards.map((card) => card.hero)).toEqual(['hela', 'storm', 'thor']);
    expect(view.cards[1]).toEqual(
      jasmine.objectContaining({ name: 'Storm', pickRateLabel: '20.0%', winRateLabel: '50.0%', appearancesLabel: '30' }),
    );
  });

  it('writes large appearance counts compactly', () => {
    expect(buildHeroUsageView(statsOf(), identities).cards[0].appearancesLabel).toBe('1.8K');
  });

  it('says the sample behind the numbers: matches counted and the half-season', () => {
    expect(buildHeroUsageView(statsOf(), identities).sourceLabel).toBe(
      'Based on Rivals Pulse players · 146 matches · Season 10.5',
    );
  });

  it('keeps the grid of a full list by counting the empty slots after a partial one', () => {
    const view = buildHeroUsageView(statsOf(), identities);

    expect(view.cards.length + view.placeholderSlots).toBe(HERO_USAGE_SLOTS);
  });

  it('shows at most five heroes and no empty slots when there are more', () => {
    const heroes = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((slug, index) => hero(slug, 20, 40 - index));
    const view = buildHeroUsageView(statsOf({ tiers: [{ name: 'C', heroes }] }), identities);

    expect(view.cards.map((card) => card.hero)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(view.placeholderSlots).toBe(0);
  });

  it('is empty, with the matches counted in its label, while no hero has enough data', () => {
    const view = buildHeroUsageView(statsOf({ status: 'not-enough-data', tiers: [] }), identities);

    expect(view.state).toBe('empty');
    expect(view.cards).toEqual([]);
    expect(view.placeholderSlots).toBe(0);
    expect(view.emptyMessage).toContain('Not enough data yet');
    expect(view.sourceLabel).toContain('146 matches');
  });

  it('has a label and no season at all when nothing exists yet', () => {
    const view = buildHeroUsageView(
      statsOf({ status: 'not-enough-data', tiers: [], halfSeason: null, halfSeasons: [], matchesCounted: 0 }),
      identities,
    );

    expect(view.state).toBe('empty');
    expect(view.sourceLabel).toBe('Based on Rivals Pulse players · 0 matches');
  });

  it('is unavailable, with a notice instead of a blank panel, when the numbers could not be read', () => {
    const view = buildHeroUsageView(null, identities);

    expect(view.state).toBe('unavailable');
    expect(view.emptyMessage).toContain('cannot be loaded');
  });

  it('leaves out a hero whose figures are not finite instead of printing NaN', () => {
    const broken = { ...hero('storm', 30, Number.NaN) };
    const view = buildHeroUsageView(statsOf({ tiers: [{ name: 'C', heroes: [broken] }] }), identities);

    expect(view.state).toBe('empty');
    expect(JSON.stringify(view)).not.toContain('NaN');
  });

  it('names the previous half-season when it stands in for the current one', () => {
    const view = buildHeroUsageView(statsOf({ halfSeason: previous, inPlaceOf: current }), identities);

    expect(view.fallbackNotice).toContain('Season 10.5 does not have enough data yet');
    expect(view.sourceLabel).toContain('Season 10');
  });
});
