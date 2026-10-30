import type {
  HeroStats,
  HeroStatsHalfSeason,
  HeroStatsHero,
} from '../../../../contracts/hero-stats.model';
import type { HeroIdentities } from '../hero-identity';
import { buildTierListView, seasonOptions } from './tier-list-view';

const season = (id: number, startsAt: string | null, endsAt: string | null): HeroStatsHalfSeason => ({
  id,
  label: `Season ${id}`,
  startsAt,
  endsAt,
});
const current = season(10.5, '2026-10-09T09:00:00Z', null);
const previous = season(10, '2026-09-11T09:00:00Z', '2026-10-09T09:00:00Z');

function hero(slug: string, appearances: number, wins: number, tier: HeroStatsHero['tier'] = 'B'): HeroStatsHero {
  return {
    hero: slug,
    appearances,
    wins,
    winRate: (wins / appearances) * 100,
    pickRate: 12.5,
    shrunkWinRate: 50,
    tier,
    kda: null,
    finalHitsAverage: null,
  };
}

function statsOf(overrides: Partial<HeroStats> = {}): HeroStats {
  return {
    status: 'ready',
    minimumMatches: 10,
    halfSeasons: [previous, current],
    halfSeason: current,
    inPlaceOf: null,
    matchesCounted: 146,
    tiers: [
      { name: 'A', heroes: [hero('storm', 12, 8, 'A')] },
      { name: 'C', heroes: [hero('thor', 10, 5, 'C')] },
    ],
    belowMinimum: [{ hero: 'luna-snow', appearances: 4 }],
    ...overrides,
  };
}

const nothingPlaced: Partial<HeroStats> = { status: 'not-enough-data', tiers: [], belowMinimum: [] };

const identities: HeroIdentities = new Map([
  ['storm', { name: 'Storm', role: 'Duelist', imageUrl: '/images/heroes/storm.png' }],
]);

describe('buildTierListView', () => {
  it('always draws all six tiers once a hero is placed, with empty ones kept as rows', () => {
    const view = buildTierListView(statsOf(), identities);

    expect(view.state).toBe('ready');
    expect(view.tiers.map((tier) => tier.name)).toEqual(['S', 'A', 'B', 'C', 'D', 'F']);
    expect(view.tiers.map((tier) => tier.heroes.length)).toEqual([0, 1, 0, 1, 0, 0]);
  });

  it('writes every figure as a finished label, with names and portraits from the roster', () => {
    const [storm] = buildTierListView(statsOf(), identities).tiers[1].heroes;

    expect(storm).toEqual(
      jasmine.objectContaining({
        name: 'Storm',
        role: 'Duelist',
        imageUrl: '/images/heroes/storm.png',
        winRateLabel: '66.7%',
        pickRateLabel: '12.5%',
        appearancesLabel: '12',
      }),
    );
  });

  it('falls back to a name made from the id for a hero the roster lacks', () => {
    const thor = buildTierListView(statsOf(), identities).tiers[3].heroes[0];

    expect(thor.name).toBe('Thor');
    expect(thor.role).toBeNull();
    expect(thor.imageUrl).toBe('/images/heroes/thor.png');
  });

  it('keeps heroes short of the minimum in the same list whether or not others are placed', () => {
    const view = buildTierListView(statsOf(), identities);

    expect(view.building.map((row) => [row.name, row.progressLabel])).toEqual([['Luna Snow', '4 of 10']]);
  });

  it('draws no tier rows when matches are counted but no hero has enough data', () => {
    const view = buildTierListView(statsOf(nothingPlaced), identities);

    expect(view.state).toBe('building');
    expect(view.tiers).toEqual([]);
    expect(view.matchesCountedLabel).toBe('146 matches');
  });

  it('is empty, with no tier rows and no building list, when nothing is counted', () => {
    const view = buildTierListView(
      statsOf({ ...nothingPlaced, matchesCounted: 0, halfSeason: null, halfSeasons: [] }),
      identities,
    );

    expect(view.state).toBe('empty');
    expect(view.season).toBeNull();
    expect(view.tiers).toEqual([]);
    expect(view.building).toEqual([]);
    expect(view.matchesCountedLabel).toBe('0 matches');
  });

  it('leaves out a line whose figures are not finite instead of printing NaN', () => {
    const broken = { ...hero('storm', 12, 8, 'A'), winRate: Number.NaN };
    const view = buildTierListView(statsOf({ tiers: [{ name: 'A', heroes: [broken] }] }), identities);

    expect(view.state).toBe('building');
    expect(JSON.stringify(view)).not.toContain('NaN');
  });

  it('names the previous half-season when it stands in for the current one', () => {
    const view = buildTierListView(statsOf({ halfSeason: previous, inPlaceOf: current }), identities);

    expect(view.season?.label).toBe('Season 10');
    expect(view.fallbackNotice).toContain('Season 10.5 does not have enough data yet');
    expect(view.fallbackNotice).toContain("Season 10's numbers");
  });

  it('gives a finished half-season both dates and the latest one a start only', () => {
    expect(buildTierListView(statsOf({ halfSeason: previous }), identities).season?.dateRange).toBe(
      'Sep 11, 2026 to Oct 9, 2026',
    );
    expect(buildTierListView(statsOf(), identities).season?.dateRange).toBe('Started Oct 9, 2026');
  });
});

describe('seasonOptions', () => {
  it('lists the newest half-season first', () => {
    expect(seasonOptions([previous, current])).toEqual([
      { id: 10.5, label: 'Season 10.5' },
      { id: 10, label: 'Season 10' },
    ]);
  });
});
