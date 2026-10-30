import type { HeroStats, HeroStatsHero } from '../../../../contracts/hero-stats.model';
import { buildHeroCommunityStatsView } from './hero-community-stats-view';

const season = (id: number) => ({ id, label: `Season ${id}`, startsAt: null, endsAt: null });

const hero = (overrides: Partial<HeroStatsHero> = {}): HeroStatsHero => ({
  hero: 'storm',
  appearances: 24,
  wins: 13,
  winRate: 54.1666,
  pickRate: 16,
  shrunkWinRate: 52.9,
  tier: 'B',
  kda: 3.456,
  finalHitsAverage: 9.04,
  ...overrides,
});

const stats = (overrides: Partial<HeroStats> = {}): HeroStats => ({
  status: 'ready',
  minimumMatches: 10,
  halfSeason: season(10.5),
  inPlaceOf: null,
  matchesCounted: 150,
  tiers: [{ name: 'B', heroes: [hero()] }],
  belowMinimum: [],
  ...overrides,
});

describe('buildHeroCommunityStatsView', () => {
  it('is loading while the stats have not answered', () => {
    expect(buildHeroCommunityStatsView(undefined, 'storm').kind).toBe('loading');
  });

  it('is unavailable when the stats could not be read', () => {
    expect(buildHeroCommunityStatsView(null, 'storm').kind).toBe('unavailable');
  });

  it('formats every figure of a hero with enough matches', () => {
    const view = buildHeroCommunityStatsView(stats(), 'storm');

    expect(view).toEqual({
      kind: 'ready',
      halfSeasonLabel: 'Season 10.5',
      fallbackFor: null,
      matchesCounted: 150,
      appearances: 24,
      figures: [
        { label: 'Win rate', value: '54.2%' },
        { label: 'Pick rate', value: '16.0%' },
        { label: 'KDA', value: '3.46' },
        { label: 'Final hits per match', value: '9.0' },
      ],
    });
  });

  it('says plainly when KDA or final hits were not recorded, instead of printing zero or NaN', () => {
    const view = buildHeroCommunityStatsView(
      stats({ tiers: [{ name: 'B', heroes: [hero({ kda: null, finalHitsAverage: null })] }] }),
      'storm',
    );

    expect(view.kind === 'ready' && view.figures.map((figure) => figure.value)).toEqual([
      '54.2%',
      '16.0%',
      'Not recorded',
      'Not recorded',
    ]);
  });

  it('labels the previous half-season when it stands in for the current one', () => {
    const view = buildHeroCommunityStatsView(
      stats({ halfSeason: season(10), inPlaceOf: season(10.5) }),
      'storm',
    );

    expect(view.kind === 'ready' && view.halfSeasonLabel).toBe('Season 10');
    expect(view.kind === 'ready' && view.fallbackFor).toBe('Season 10.5');
  });

  it('shows the matches so far for a hero below the minimum', () => {
    const view = buildHeroCommunityStatsView(
      stats({ belowMinimum: [{ hero: 'storm', appearances: 4 }], tiers: [] }),
      'storm',
    );

    expect(view).toEqual({
      kind: 'not-enough-data',
      halfSeasonLabel: 'Season 10.5',
      fallbackFor: null,
      appearances: 4,
      minimumMatches: 10,
    });
  });

  it('shows no matches for a hero the data never mentions, and never a rate', () => {
    const view = buildHeroCommunityStatsView(
      stats({ status: 'not-enough-data', tiers: [], belowMinimum: [], matchesCounted: 0, halfSeason: null }),
      'storm',
    );

    expect(view).toEqual({
      kind: 'not-enough-data',
      halfSeasonLabel: null,
      fallbackFor: null,
      appearances: 0,
      minimumMatches: 10,
    });
  });

  it('ignores another hero when it picks the figures', () => {
    const view = buildHeroCommunityStatsView(stats(), 'rocket-raccoon');

    expect(view.kind).toBe('not-enough-data');
  });

  it('treats a non-finite rate from the server as unavailable rather than printing NaN', () => {
    const view = buildHeroCommunityStatsView(
      stats({ tiers: [{ name: 'B', heroes: [hero({ winRate: Number.NaN })] }] }),
      'storm',
    );

    expect(view.kind).toBe('unavailable');
  });
});
