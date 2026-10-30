import type {
  HeroStats,
  HeroStatsHalfSeason,
  HeroStatsHero,
} from '../../../../contracts/hero-stats.model';
import type { HeroIdentities } from '../hero-identity';
import { buildWinRatesView } from './win-rates-view';

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

describe('buildWinRatesView', () => {
  describe('with heroes past the minimum', () => {
    it('ranks heroes by win rate, then appearances', () => {
      const view = buildWinRatesView(statsOf(), null, identities);

      expect(view.state).toBe('full');
      expect(view.ranked.map((row) => row.hero)).toEqual(['storm', 'hela', 'thor']);
    });

    it('writes every figure as a finished label', () => {
      const [storm, hela] = buildWinRatesView(statsOf(), null, identities).ranked;

      expect(storm.winRateLabel).toBe('66.7%');
      expect(storm.appearancesLabel).toBe('12');
      expect(storm.winsLabel).toBe('8 wins');
      expect(storm.tone).toBe('above');
      expect(hela.tone).toBe('even');
    });

    it('takes names, roles and portraits from the roster, and falls back for a hero it lacks', () => {
      const view = buildWinRatesView(statsOf(), null, identities);

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
      const view = buildWinRatesView(statsOf(), null, identities);

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
        null,
        identities,
      );

      expect(view.building.map((row) => row.hero)).toEqual(['storm', 'hela', 'thor']);
    });

    it('names the half-season, its dates and the matches counted', () => {
      const view = buildWinRatesView(statsOf(), null, identities);

      expect(view.season).toEqual({
        id: 10.5,
        label: 'Season 10.5',
        dateRange: 'Started Oct 9, 2026',
      });
      expect(view.matchesCountedLabel).toBe('149 matches');
      expect(view.fallbackNotice).toBeNull();
    });

    it('gives a finished half-season both of its dates', () => {
      const view = buildWinRatesView(statsOf({ halfSeason: previous }), null, identities);

      expect(view.season?.dateRange).toBe('Sep 11, 2026 to Oct 9, 2026');
    });

    it('says when the previous half-season is shown in place of the current one', () => {
      const view = buildWinRatesView(
        statsOf({ halfSeason: previous, inPlaceOf: current }),
        null,
        identities,
      );

      expect(view.state).toBe('full');
      expect(view.fallbackNotice).toBe(
        "Season 10.5 does not have enough data yet, so these are Season 10's numbers until it does.",
      );
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
      const view = buildWinRatesView(partial, null, identities);

      expect(view.state).toBe('partial');
      expect(view.matchesCountedLabel).toBe('1 match');
      expect(view.ranked).toEqual([]);
      expect(view.building.map((row) => row.progressLabel)).toEqual(['1 of 10']);
    });

    it('stays partial when matches are counted but no hero line is listed', () => {
      const view = buildWinRatesView({ ...partial, belowMinimum: [] }, null, identities);

      expect(view.state).toBe('partial');
    });
  });

  describe('with nothing counted', () => {
    it('is the empty state for a half-season with no matches', () => {
      const view = buildWinRatesView(statsOf(nothingCounted), null, identities);

      expect(view.state).toBe('empty');
      expect(view.matchesCountedLabel).toBe('0 matches');
      expect(view.season?.label).toBe('Season 10.5');
    });

    it('is the empty state before any half-season exists, whatever the address names', () => {
      const view = buildWinRatesView(
        statsOf({ ...nothingCounted, halfSeason: null }),
        '9',
        identities,
      );

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
          null,
          identities,
        );

        expect(view.ranked).toEqual([]);
        expect(view.state).toBe('partial');
      }
    });
  });

  describe('for the season in the address', () => {
    it('shows the served half-season for a bare address or a segment that is not a number', () => {
      expect(buildWinRatesView(statsOf(), null, identities).state).toBe('full');
      expect(buildWinRatesView(statsOf(), 'week-2', identities).state).toBe('full');
      expect(buildWinRatesView(statsOf(), '', identities).state).toBe('full');
    });

    it('ignores a segment that is not a whole or half season number', () => {
      for (const odd of ['1e1', '-3', '0', '9.25', '10.0', ' 9', '9abc']) {
        expect(buildWinRatesView(statsOf(), odd, identities).state).withContext(odd).toBe('full');
      }
    });

    it('shows the served half-season when the address names it', () => {
      expect(buildWinRatesView(statsOf(), '10.5', identities).state).toBe('full');
    });

    it('accepts the current half-season while the previous one is shown in its place', () => {
      const view = buildWinRatesView(
        statsOf({ halfSeason: previous, inPlaceOf: current }),
        '10.5',
        identities,
      );

      expect(view.state).toBe('full');
    });

    it('is the unavailable-season state, never an error, for a half-season the site holds nothing for', () => {
      const view = buildWinRatesView(statsOf(), '9', identities);

      expect(view.state).toBe('unavailable-season');
      expect(view.requestedLabel).toBe('Season 9');
      expect(view.season?.label).toBe('Season 10.5');
      expect(view.ranked).toEqual([]);
    });
  });
});
