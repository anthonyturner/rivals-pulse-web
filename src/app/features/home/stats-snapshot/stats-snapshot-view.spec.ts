import type { HeroStats } from '../../../../contracts/hero-stats.model';
import type { HeroIdentities } from '../../insights/hero-identity';
import { season, statsHero, statsOf } from '../../insights/hero-stats.fixtures';
import { buildStatsSnapshotView, SNAPSHOT_SLOTS, type SnapshotPanelView, type StatsSnapshotView } from './stats-snapshot-view';

const identities: HeroIdentities = new Map([
  ['hulk', { name: 'Hulk', role: 'Vanguard', imageUrl: '/images/heroes/hulk.png' }],
  ['thor', { name: 'Thor', role: 'Vanguard', imageUrl: '/images/heroes/thor.png' }],
  ['storm', { name: 'Storm', role: 'Duelist', imageUrl: '/images/heroes/storm.png' }],
  ['mantis', { name: 'Mantis', role: 'Strategist', imageUrl: '/images/heroes/mantis.png' }],
]);

function ready(view: StatsSnapshotView): Extract<StatsSnapshotView, { kind: 'ready' }> {
  if (view.kind !== 'ready') {
    throw new Error(`expected a ready snapshot, got ${view.kind}`);
  }

  return view;
}

function panel(view: StatsSnapshotView, id: string): SnapshotPanelView {
  const found = ready(view).panels.find((candidate) => candidate.id === id);

  if (found === undefined) {
    throw new Error(`no ${id} panel`);
  }

  return found;
}

const sample = statsOf([
  { name: 'S', heroes: [statsHero('hulk', 30, 18, 20, 'S')] },
  { name: 'C', heroes: [statsHero('storm', 24, 12, 30), statsHero('mantis', 12, 5, 8), statsHero('thor', 1800, 900, 55)] },
]);

describe('buildStatsSnapshotView', () => {
  it('has the tabs All, Vanguard, Duelist and Strategist, in that order', () => {
    expect(ready(buildStatsSnapshotView(sample, identities)).panels.map((tab) => tab.label)).toEqual([
      'All',
      'Vanguard',
      'Duelist',
      'Strategist',
    ]);
  });

  it('orders the All tab by pick rate, with finished labels', () => {
    const view = buildStatsSnapshotView(sample, identities);

    expect(panel(view, 'all').rows.map((row) => row.hero)).toEqual(['thor', 'storm', 'hulk', 'mantis']);
    expect(panel(view, 'all').rows[1]).toEqual(
      jasmine.objectContaining({
        name: 'Storm',
        role: 'Duelist',
        winRateLabel: '50.0%',
        pickRateLabel: '30.0%',
        appearancesLabel: '24',
      }),
    );
  });

  it('writes large appearance counts with a thousands separator', () => {
    expect(panel(buildStatsSnapshotView(sample, identities), 'all').rows[0].appearancesLabel).toBe('1,800');
  });

  it('keeps only the heroes of a role on that role tab', () => {
    const view = buildStatsSnapshotView(sample, identities);

    expect(panel(view, 'vanguard').rows.map((row) => row.hero)).toEqual(['thor', 'hulk']);
    expect(panel(view, 'duelist').rows.map((row) => row.hero)).toEqual(['storm']);
    expect(panel(view, 'strategist').rows.map((row) => row.hero)).toEqual(['mantis']);
  });

  it('shows at most five heroes on a tab', () => {
    const slugs = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const view = buildStatsSnapshotView(
      statsOf([{ name: 'C', heroes: slugs.map((slug, index) => statsHero(slug, 20, 10, 40 - index)) }]),
      new Map(),
    );

    expect(panel(view, 'all').rows.map((row) => row.hero)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(panel(view, 'all').rows.length).toBe(SNAPSHOT_SLOTS);
  });

  it('lists a hero the roster does not know on the All tab only, under its spelled-out id', () => {
    const view = buildStatsSnapshotView(statsOf([{ name: 'C', heroes: [statsHero('doctor-strange', 20, 10, 12)] }]), identities);

    expect(panel(view, 'all').rows.map((row) => row.name)).toEqual(['Doctor Strange']);
    expect(panel(view, 'vanguard').rows).toEqual([]);
  });

  describe('the tier badge', () => {
    it('carries the tier the hero is placed in', () => {
      const rows = panel(buildStatsSnapshotView(sample, identities), 'all').rows;

      expect(rows.find((row) => row.hero === 'hulk')?.tier).toBe('S');
      expect(rows.find((row) => row.hero === 'storm')?.tier).toBe('C');
    });

    it('is absent, never a placeholder letter, for a hero in no known tier', () => {
      const stats = statsOf([{ name: 'Z' as never, heroes: [statsHero('hulk', 20, 10, 12)] }]);

      expect(panel(buildStatsSnapshotView(stats, identities), 'all').rows[0].tier).toBeNull();
    });

    it('leaves a hero below the minimum out of the list altogether', () => {
      const stats = statsOf([{ name: 'C', heroes: [statsHero('hulk', 20, 10, 12)] }], {
        belowMinimum: [{ hero: 'storm', appearances: 4 }],
      });

      expect(panel(buildStatsSnapshotView(stats, identities), 'all').rows.map((row) => row.hero)).toEqual(['hulk']);
    });
  });

  describe('the win rate cue', () => {
    it('says which side of 50% the win rate is on', () => {
      const stats = statsOf([
        { name: 'C', heroes: [statsHero('hulk', 20, 12, 30), statsHero('thor', 20, 8, 20), statsHero('storm', 20, 10, 10)] },
      ]);
      const sides = panel(buildStatsSnapshotView(stats, identities), 'all').rows.map((row) => row.winRateSide);

      expect(sides).toEqual(['above', 'below', 'even']);
    });
  });

  describe('a tab with no qualifying hero', () => {
    const emptyRole = buildStatsSnapshotView(statsOf([{ name: 'C', heroes: [statsHero('storm', 20, 10, 12)] }]), identities);

    it('names the role and the appearance minimum', () => {
      expect(panel(emptyRole, 'vanguard')).toEqual(
        jasmine.objectContaining({
          rows: [],
          emptyMessage: 'Not enough Vanguard data yet. A hero appears after 10 appearances.',
        }),
      );
    });

    it('does not blame the data when the hero list could not be loaded', () => {
      const view = buildStatsSnapshotView(statsOf([{ name: 'C', heroes: [statsHero('storm', 20, 10, 12)] }]), new Map());

      expect(panel(view, 'duelist').emptyMessage).toContain('hero list could not be loaded');
    });

    it('has its own message on the All tab while no match has enough data', () => {
      const view = buildStatsSnapshotView(statsOf([]), identities);

      expect(panel(view, 'all')).toEqual(
        jasmine.objectContaining({
          rows: [],
          emptyMessage: 'Stats appear once enough matches are uploaded. A hero is listed after 10 appearances.',
        }),
      );
    });
  });

  describe('the heading and the sample', () => {
    it('says the half-season of the stats themselves, and the matches behind them', () => {
      const view = ready(buildStatsSnapshotView(sample, identities));

      expect(view.halfSeasonLabel).toBe('Season 10.5');
      expect(view.sample).toBe('From 149 matches by Rivals Pulse players. Only heroes with at least 10 appearances are listed.');
    });

    it('names the previous half-season when it stands in for the current one', () => {
      const previous = season(10);
      const stats: HeroStats = { ...sample, halfSeason: previous, inPlaceOf: season(10.5) };
      const view = ready(buildStatsSnapshotView(stats, identities));

      expect(view.halfSeasonLabel).toBe(previous.label);
      expect(view.fallbackNotice).toContain('Season 10.5 does not have enough data yet');
    });

    it('states no match count and no season when nothing exists yet', () => {
      const view = ready(
        buildStatsSnapshotView(statsOf([], { halfSeason: null, halfSeasons: [], matchesCounted: 0 }), identities),
      );

      expect(view.halfSeasonLabel).toBeNull();
      expect(view.sample).toBe('From matches recorded by Rivals Pulse players. Only heroes with at least 10 appearances are listed.');
    });

    it('uses the singular for one match', () => {
      const view = ready(buildStatsSnapshotView(statsOf([], { matchesCounted: 1 }), identities));

      expect(view.sample).toContain('From 1 match by');
    });
  });

  it('is unavailable, with a notice instead of a blank panel, when the numbers could not be read', () => {
    const view = buildStatsSnapshotView(null, identities);

    expect(view).toEqual({ kind: 'unavailable', message: jasmine.stringContaining('cannot be loaded') });
  });

  it('leaves out a hero whose figures are not finite instead of printing NaN or Infinity', () => {
    const broken = { ...statsHero('storm', 20, 10, 12), pickRate: Number.NaN };
    const alsoBroken = { ...statsHero('thor', 20, 10, 12), winRate: Number.POSITIVE_INFINITY };
    const view = buildStatsSnapshotView(statsOf([{ name: 'C', heroes: [broken, alsoBroken] }]), identities);

    expect(panel(view, 'all').rows).toEqual([]);
    expect(JSON.stringify(view)).not.toMatch(/NaN|Infinity/);
  });
});
