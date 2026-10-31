import type { HeroStats, HeroStatsHalfSeason } from '../../../../contracts/hero-stats.model';
import { buildHeroTrustLine } from './hero-trust-line-view';

const current: HeroStatsHalfSeason = { id: 10.5, label: 'Season 10.5', startsAt: '2026-10-09T09:00:00Z', endsAt: null };
const previous: HeroStatsHalfSeason = {
  id: 10,
  label: 'Season 10',
  startsAt: '2026-09-11T09:00:00Z',
  endsAt: '2026-10-09T09:00:00Z',
};

function statsOf(overrides: Partial<HeroStats> = {}): HeroStats {
  return {
    status: 'ready',
    minimumMatches: 10,
    halfSeasons: [previous, current],
    halfSeason: current,
    inPlaceOf: null,
    matchesCounted: 1482,
    tiers: [],
    belowMinimum: [],
    ...overrides,
  };
}

describe('buildHeroTrustLine', () => {
  it('states the matches counted and the half-season they come from', () => {
    expect(buildHeroTrustLine(statsOf())).toEqual({ state: 'counted', text: '1,482 matches counted · Season 10.5' });
  });

  it('says "match" for exactly one', () => {
    expect(buildHeroTrustLine(statsOf({ matchesCounted: 1 })).text).toBe('1 match counted · Season 10.5');
  });

  it('names the previous half-season while it stands in for the current one', () => {
    const line = buildHeroTrustLine(statsOf({ halfSeason: previous, inPlaceOf: current, matchesCounted: 146 }));

    expect(line.text).toBe('146 matches counted · Season 10');
  });

  it('leaves the half-season out when none is known', () => {
    expect(buildHeroTrustLine(statsOf({ halfSeason: null })).text).toBe('1,482 matches counted');
  });

  it('shows no number when the stats could not be read', () => {
    expect(buildHeroTrustLine(null)).toEqual({ state: 'neutral', text: 'Counted from Rivals Pulse player uploads' });
  });

  it('shows no zero or NaN when nothing has been counted', () => {
    for (const matchesCounted of [0, Number.NaN, Number.POSITIVE_INFINITY, -3]) {
      const line = buildHeroTrustLine(statsOf({ status: 'not-enough-data', matchesCounted }));

      expect(line).toEqual({ state: 'neutral', text: 'Counted from Rivals Pulse player uploads' });
    }
  });
});
