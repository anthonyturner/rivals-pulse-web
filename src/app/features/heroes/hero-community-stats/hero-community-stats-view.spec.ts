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
  halfSeasons: [season(10), season(10.5)],
  halfSeason: season(10.5),
  inPlaceOf: null,
  matchesCounted: 150,
  tiers: [{ name: 'B', heroes: [hero()] }],
  belowMinimum: [],
  ...overrides,
});

describe('buildHeroCommunityStatsView', () => {
  it('is loading while the stats have not answered', () => {
    expect(buildHeroCommunityStatsView(undefined, 'storm', 'Storm').kind).toBe('loading');
  });

  it('is unavailable when the stats could not be read', () => {
    expect(buildHeroCommunityStatsView(null, 'storm', 'Storm').kind).toBe('unavailable');
  });

  it('says "1 match" for a single match counted', () => {
    const view = buildHeroCommunityStatsView(stats({ matchesCounted: 1 }), 'storm', 'Storm');

    expect(view.kind === 'ready' && view.sample).toContain('in 1 match recorded');
  });

  it('formats every figure of a hero with enough matches', () => {
    const view = buildHeroCommunityStatsView(stats(), 'storm', 'Storm');

    expect(view).toEqual({
      kind: 'ready',
      halfSeasonLabel: 'Season 10.5',
      fallbackFor: null,
      notice: null,
      sample:
        'From 24 appearances in 150 matches recorded by Rivals Pulse players. Pick rate is a share of those matches, so a hero on both teams of one match counts twice.',
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
      'Storm',
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
      'Storm',
    );

    expect(view.kind === 'ready' && view.halfSeasonLabel).toBe('Season 10');
    expect(view.kind === 'ready' && view.fallbackFor).toBe('Season 10.5');
    expect(view.kind === 'ready' && view.notice).toBe(
      "Season 10.5 does not have enough data yet, so these are Season 10's numbers until it does.",
    );
  });

  it('shows the matches so far for a hero below the minimum', () => {
    const view = buildHeroCommunityStatsView(
      stats({ belowMinimum: [{ hero: 'storm', appearances: 4 }], tiers: [] }),
      'storm',
      'Storm',
    );

    expect(view).toEqual({
      kind: 'not-enough-data',
      halfSeasonLabel: 'Season 10.5',
      fallbackFor: null,
      summary:
        'Storm has 4 appearances so far, from matches recorded by Rivals Pulse players. The numbers appear at 10 appearances.',
    });
  });

  it('says which half-season the appearances are from when the previous one stands in', () => {
    const view = buildHeroCommunityStatsView(
      stats({
        status: 'ready',
        halfSeason: season(10),
        inPlaceOf: season(10.5),
        tiers: [{ name: 'B', heroes: [hero({ hero: 'other' })] }],
        belowMinimum: [{ hero: 'storm', appearances: 1 }],
      }),
      'storm',
      'Storm',
    );

    expect(view).toEqual({
      kind: 'not-enough-data',
      halfSeasonLabel: 'Season 10',
      fallbackFor: 'Season 10.5',
      summary:
        'Storm has 1 appearance so far in Season 10, from matches recorded by Rivals Pulse players. The numbers appear at 10 appearances.',
    });
  });

  it('shows no matches for a hero the data never mentions, and never a rate', () => {
    const view = buildHeroCommunityStatsView(
      stats({ status: 'not-enough-data', tiers: [], belowMinimum: [], matchesCounted: 0, halfSeason: null }),
      'storm',
      'Storm',
    );

    expect(view).toEqual({
      kind: 'not-enough-data',
      halfSeasonLabel: null,
      fallbackFor: null,
      summary:
        'No match recorded by Rivals Pulse players has Storm yet. The numbers appear at 10 appearances.',
    });
  });

  it('ignores another hero when it picks the figures', () => {
    const view = buildHeroCommunityStatsView(stats(), 'rocket-raccoon', 'Rocket Raccoon');

    expect(view.kind).toBe('not-enough-data');
  });

  it('treats a non-finite rate from the server as unavailable rather than printing NaN', () => {
    const view = buildHeroCommunityStatsView(
      stats({ tiers: [{ name: 'B', heroes: [hero({ winRate: Number.NaN })] }] }),
      'storm',
      'Storm',
    );

    expect(view.kind).toBe('unavailable');
  });
});
