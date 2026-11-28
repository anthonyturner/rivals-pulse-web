import type {
  HeroStats,
  HeroStatsHalfSeason,
  HeroStatsHero,
  HeroStatsMode,
  HeroStatsModeId,
} from '../../../../../contracts/hero-stats.model';
import type { HeroIdentities } from '../../../insights/hero-identity';
import { buildWinRatesView, selectHeroStatsRows } from './win-rates-view';

const season = (id: number, startsAt: string | null, endsAt: string | null): HeroStatsHalfSeason => ({
  id,
  label: `Season ${id}`,
  startsAt,
  endsAt,
});
const current = season(10.5, '2026-10-09T09:00:00Z', null);
const previous = season(10, '2026-09-11T09:00:00Z', '2026-10-09T09:00:00Z');

function hero(slug: string, appearances: number, wins: number): HeroStatsHero {
  return {
    hero: slug,
    appearances,
    wins,
    winRate: (wins / appearances) * 100,
    pickRate: 10,
    shrunkWinRate: 50,
    tier: 'B',
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
    matchesCounted: 149,
    tiers: [
      { name: 'A', heroes: [hero('storm', 12, 8), hero('hela', 20, 10)] },
      { name: 'C', heroes: [hero('thor', 10, 3)] },
    ],
    belowMinimum: [
      { hero: 'luna-snow', appearances: 4 },
      { hero: 'mantis', appearances: 0 },
    ],
    ...overrides,
  };
}

const nothingCounted: Partial<HeroStats> = {
  status: 'not-enough-data',
  matchesCounted: 0,
  tiers: [],
  belowMinimum: [],
};

const identities: HeroIdentities = new Map([
  ['storm', { name: 'Storm', role: 'Duelist', imageUrl: '/images/heroes/storm.png' }],
  ['luna-snow', { name: 'Luna Snow', role: 'Strategist', imageUrl: '/images/heroes/luna-snow.png' }],
]);

const MODES: HeroStatsMode[] = [
  { id: 'all', label: 'Quick Match and Competitive', decidedMatches: 173 },
  { id: 'quick-match', label: 'Quick Match', decidedMatches: 145 },
  { id: 'competitive', label: 'Competitive', decidedMatches: 28 },
  { id: 'arcade', label: 'Arcade', decidedMatches: 0 },
  { id: 'practice', label: 'Practice', decidedMatches: 1 },
];

describe('buildWinRatesView', () => {
  it('shows uncapped pick rates, leaving a missing pick rate unavailable', () => {
    const view = buildWinRatesView(statsOf({ tiers: [{ name: 'B', heroes: [
      { ...hero('storm', 12, 8), pickRate: 120 },
      { ...hero('hela', 20, 10), pickRate: Number.NaN },
    ] }] }), identities);

    expect(view.ranked.map((row) => row.pickRateLabel)).toEqual(['120.0%', 'Not available']);
    expect(view.ranked[1].pickRate).toBeNull();
  });

  it('filters names and roles together and sorts picks with missing figures last', () => {
    const view = buildWinRatesView(statsOf({ tiers: [{ name: 'B', heroes: [
      { ...hero('storm', 12, 8), pickRate: 120 },
      { ...hero('luna-snow', 20, 10), pickRate: 30 },
      { ...hero('hela', 20, 10), pickRate: Number.NaN },
    ] }] }), identities);

    expect(selectHeroStatsRows(view.ranked, '  SNOW ', 'Strategist', 'pick-desc').map((row) => row.hero)).toEqual(['luna-snow']);
    expect(selectHeroStatsRows(view.ranked, '', '', 'pick-asc').map((row) => row.hero)).toEqual(['luna-snow', 'storm', 'hela']);
    expect(selectHeroStatsRows(view.ranked, 'missing', '', 'win-desc')).toEqual([]);
    expect(selectHeroStatsRows(view.ranked, '', '', 'win-asc')[0].hero).toBe('hela');
    expect(view.ranked[0].hero).toBe('storm');
  });

  describe('with heroes past the minimum', () => {
    it('ranks heroes by win rate, then appearances', () => {
      const view = buildWinRatesView(statsOf(), identities);

      expect(view.state).toBe('full');
      expect(view.ranked.map((row) => row.hero)).toEqual(['storm', 'hela', 'thor']);
    });

    it('writes every figure as a finished label', () => {
      const [storm, hela] = buildWinRatesView(statsOf(), identities).ranked;

      expect(storm.winRateLabel).toBe('66.7%');
      expect(storm.winsGamesLabel).toBe('8 / 12');
      expect(storm.winsGamesSpoken).toBe('8 wins in 12 games');
      expect(storm.tone).toBe('above');
      expect(hela.tone).toBe('even');
    });

    it('numbers the rows in the order they are ranked', () => {
      const view = buildWinRatesView(statsOf(), identities);

      expect(view.ranked.map((row) => row.rank)).toEqual([1, 2, 3]);
    });

    it('says "1 win in 1 game" and "1 appearance" in the singular', () => {
      const view = buildWinRatesView(
        statsOf({ minimumMatches: 1, tiers: [{ name: 'A', heroes: [hero('storm', 1, 1)] }] }),
        identities,
      );

      expect(view.ranked[0].winsGamesSpoken).toBe('1 win in 1 game');
      expect(view.minimumLabel).toBe('1 appearance');
      expect(view.metaParts).toContain('Heroes need 1 appearance to be listed');
    });

    it('lists the facts the toolbar shows, in order, once a table is drawn', () => {
      const view = buildWinRatesView(statsOf(), identities);

      expect(view.metaParts).toEqual([
        'Season 10.5',
        'Started Oct 9, 2026',
        '149 matches with a result',
        'Heroes need 10 appearances to be listed',
        'Bars show win rate; the line marks 50%.',
      ]);
    });

    it('leaves the bar sentence out while there is no table, and everything out while nothing is counted', () => {
      const partial = buildWinRatesView(statsOf({ tiers: [] }), identities);
      const empty = buildWinRatesView(statsOf(nothingCounted), identities);

      expect(partial.state).toBe('partial');
      expect(partial.metaParts).not.toContain('Bars show win rate; the line marks 50%.');
      expect(partial.metaParts.length).toBe(4);
      expect(empty.metaParts).toEqual([]);
    });

    it('takes names, roles and portraits from the roster, and falls back for a hero it lacks', () => {
      const view = buildWinRatesView(statsOf(), identities);

      expect(view.ranked[0]).toEqual(
        jasmine.objectContaining({
          name: 'Storm',
          role: 'Duelist',
          imageUrl: '/images/heroes/storm.png',
        }),
      );
      expect(view.ranked[2]).toEqual(
        jasmine.objectContaining({ name: 'Thor', role: null, imageUrl: '/images/heroes/thor.png' }),
      );
    });

    it('lists heroes short of the minimum with their progress, leaving out heroes never seen', () => {
      const view = buildWinRatesView(statsOf(), identities);

      expect(view.building.length).toBe(1);
      expect(view.building[0]).toEqual(
        jasmine.objectContaining({
          name: 'Luna Snow',
          progressLabel: '4 of 10',
          progressPercent: 40,
        }),
      );
    });

    it('lists the heroes closest to the minimum first', () => {
      const view = buildWinRatesView(
        statsOf({
          belowMinimum: [
            { hero: 'thor', appearances: 2 },
            { hero: 'storm', appearances: 9 },
            { hero: 'hela', appearances: 2 },
          ],
        }),
        identities,
      );

      expect(view.building.map((row) => row.hero)).toEqual(['storm', 'hela', 'thor']);
    });

    it('names the half-season, its dates and the matches counted', () => {
      const view = buildWinRatesView(statsOf(), identities);

      expect(view.season).toEqual({
        id: 10.5,
        label: 'Season 10.5',
        dateRange: 'Started Oct 9, 2026',
      });
      expect(view.decidedMatchesLabel).toBe('149 matches with a result');
      expect(view.fallbackNotice).toBeNull();
    });

    it('gives a finished half-season both of its dates', () => {
      const view = buildWinRatesView(statsOf({ halfSeason: previous }), identities);

      expect(view.season?.dateRange).toBe('Sep 11, 2026 to Oct 9, 2026');
    });

    it('says when the previous half-season is shown in place of the current one', () => {
      const view = buildWinRatesView(
        statsOf({ halfSeason: previous, inPlaceOf: current }),
        identities,
      );

      expect(view.state).toBe('full');
      expect(view.fallbackNotice).toBe(
        "Season 10.5 does not have enough data yet, so these are Season 10's numbers until it does.",
      );
    });
  });

  describe('the mode counted', () => {
    const inMode = (mode: HeroStatsModeId, overrides: Partial<HeroStats> = {}): HeroStats =>
      statsOf({ mode, modes: MODES, ...overrides });

    it('names the default blend, with no caveat', () => {
      const view = buildWinRatesView(inMode('all'), identities);

      expect(view.modeLabel).toBe('Quick Match and Competitive');
      expect(view.modeCaveat).toBeNull();
      expect(view.scopeLabel).toBe('in Quick Match and Competitive for Season 10.5');
    });

    it('names an empty mode and its half-season', () => {
      const view = buildWinRatesView(
        inMode('competitive', { ...nothingCounted, matchesCounted: 0 }),
        identities,
      );

      expect(view.state).toBe('empty');
      expect(view.scopeLabel).toBe('in Competitive for Season 10.5');
    });

    it('names the mode in the fall-back notice for a mode on its own', () => {
      const view = buildWinRatesView(
        inMode('competitive', { halfSeason: previous, inPlaceOf: current }),
        identities,
      );

      expect(view.fallbackNotice).toBe(
        "Season 10.5 does not have enough Competitive data yet, so these are Season 10's Competitive numbers until it does.",
      );
    });

    it('warns that Arcade and Practice are not comparable', () => {
      expect(buildWinRatesView(inMode('arcade'), identities).modeCaveat).toContain('Arcade');
      expect(buildWinRatesView(inMode('practice'), identities).modeCaveat).toContain('bots');
      expect(buildWinRatesView(inMode('quick-match'), identities).modeCaveat).toBeNull();
    });
  });

  describe('with matches counted but no hero past the minimum', () => {
    const partial = statsOf({
      status: 'not-enough-data',
      matchesCounted: 1,
      tiers: [],
      belowMinimum: [{ hero: 'storm', appearances: 1 }],
    });

    it("is the partial state, with the matches counted and each hero's progress", () => {
      const view = buildWinRatesView(partial, identities);

      expect(view.state).toBe('partial');
      expect(view.decidedMatchesLabel).toBe('1 match with a result');
      expect(view.ranked).toEqual([]);
      expect(view.building.map((row) => row.progressLabel)).toEqual(['1 of 10']);
    });

    it('stays partial when matches are counted but no hero line is listed', () => {
      const view = buildWinRatesView({ ...partial, belowMinimum: [] }, identities);

      expect(view.state).toBe('partial');
    });
  });

  describe('with nothing counted', () => {
    it('is the empty state for a half-season with no matches', () => {
      const view = buildWinRatesView(statsOf(nothingCounted), identities);

      expect(view.state).toBe('empty');
      expect(view.decidedMatchesLabel).toBe('0 matches with a result');
      expect(view.season?.label).toBe('Season 10.5');
    });

    it('is the empty state before any half-season exists', () => {
      const view = buildWinRatesView(statsOf({ ...nothingCounted, halfSeason: null }), identities);

      expect(view.state).toBe('empty');
      expect(view.season).toBeNull();
    });

    it('leaves out a hero row whose figures are not finite', () => {
      for (const broken of [
        { ...hero('storm', 12, 8), winRate: Number.NaN },
        { ...hero('storm', 12, 8), wins: Number.NaN },
      ]) {
        const view = buildWinRatesView(
          statsOf({ tiers: [{ name: 'A', heroes: [broken] }], belowMinimum: [] }),
          identities,
        );

        expect(view.ranked).toEqual([]);
        expect(view.state).toBe('partial');
      }
    });
  });
});
