import type { RoleStats, RoleStatsRole } from '../../../../contracts/role-stats.model';
import { buildRoleStatsView } from './role-stats-view';

function role(name: RoleStatsRole['role'], extra: Partial<RoleStatsRole> = {}): RoleStatsRole {
  return {
    role: name,
    appearances: 0,
    status: 'not-enough-data',
    winRate: null,
    killsAverage: null,
    deathsAverage: null,
    assistsAverage: null,
    kda: null,
    finalHitsAverage: null,
    ...extra,
  };
}

const READY_VANGUARD = role('Vanguard', {
  appearances: 120,
  status: 'ready',
  winRate: 54.1666,
  killsAverage: 7.25,
  deathsAverage: 5,
  assistsAverage: 4.5,
  kda: 2.35,
  finalHitsAverage: 11.04,
});

function statsOf(extra: Partial<RoleStats> = {}): RoleStats {
  return {
    status: 'ready',
    minimumLines: 50,
    halfSeasons: [],
    halfSeason: { id: 10.5, label: 'Season 10.5', startsAt: null, endsAt: null },
    inPlaceOf: null,
    modes: [
      {
        id: 'all',
        label: 'Quick Match and Competitive',
        roles: [READY_VANGUARD, role('Duelist', { appearances: 12 }), role('Strategist')],
      },
      {
        id: 'quick-match',
        label: 'Quick Match',
        roles: [role('Vanguard', { appearances: 30 }), role('Duelist'), role('Strategist')],
      },
      { id: 'competitive', label: 'Competitive', roles: [role('Vanguard'), role('Duelist'), role('Strategist')] },
    ],
    ...extra,
  };
}

function ready(stats: RoleStats, mode = 'all') {
  const view = buildRoleStatsView(stats, mode);

  if (view.kind !== 'ready') {
    throw new Error(`expected ready, got ${view.kind}`);
  }

  return view;
}

function summaryOf(stats: RoleStats): string {
  const view = buildRoleStatsView(stats, 'all');

  if (view.kind !== 'not-enough-data') {
    throw new Error(`expected not-enough-data, got ${view.kind}`);
  }

  return view.summary;
}

describe('buildRoleStatsView', () => {
  it('is loading until the stats answer, and unavailable when they could not be read', () => {
    expect(buildRoleStatsView(undefined, 'all').kind).toBe('loading');
    expect(buildRoleStatsView(null, 'all').kind).toBe('unavailable');
  });

  it("shows a role's figures as readable text", () => {
    const [vanguard] = ready(statsOf()).cards;

    expect(vanguard.ready).toBeTrue();
    expect(vanguard.appearancesLabel).toBe('120 lines');
    expect(vanguard.figures).toEqual([
      { label: 'Win rate', value: '54.2%' },
      { label: 'KDA', value: '2.35' },
      { label: 'Kills', value: '7.3' },
      { label: 'Deaths', value: '5.0' },
      { label: 'Assists', value: '4.5' },
      { label: 'Final hits', value: '11.0' },
    ]);
  });

  it('says how far a role is from the minimum instead of showing figures', () => {
    const [, duelist, strategist] = ready(statsOf()).cards;

    expect(duelist.ready).toBeFalse();
    expect(duelist.figures).toEqual([]);
    expect(duelist.message).toBe('Not enough data yet: 12 of 50 lines.');
    expect(strategist.message).toBe('Not enough data yet: no lines recorded so far.');
  });

  it('says "Not enough data" for a single figure a ready role does not have, never blank, zero or NaN', () => {
    const stats = statsOf({
      modes: [
        {
          id: 'all',
          label: 'All',
          roles: [
            role('Vanguard', { appearances: 60, status: 'ready', winRate: 50, kda: null, finalHitsAverage: Number.NaN }),
            role('Duelist'),
            role('Strategist'),
          ],
        },
      ],
    });
    const values = ready(stats).cards[0].figures.map((figure) => figure.value);

    expect(values).toContain('50.0%');
    expect(values.filter((value) => value === 'Not enough data').length).toBe(5);
    expect(values.join(' ')).not.toMatch(/NaN|undefined|null|Infinity/);
  });

  it('lists the modes, marks the chosen one, and falls back to the first for an unknown mode', () => {
    expect(ready(statsOf(), 'competitive').modes.map((mode) => [mode.id, mode.selected])).toEqual([
      ['all', false],
      ['quick-match', false],
      ['competitive', true],
    ]);
    expect(ready(statsOf(), 'nonsense').modes[0].selected).toBeTrue();
    expect(ready(statsOf(), 'quick-match').cards[0].appearancesLabel).toBe('30 lines');
  });

  it('keeps the mode switch when the chosen mode has no ready role while another has', () => {
    const view = ready(statsOf(), 'competitive');

    expect(view.cards.every((card) => !card.ready)).toBeTrue();
    expect(view.modes.length).toBe(3);
  });

  it('labels the half-season and notes a previous half-season standing in for the current one', () => {
    const view = ready(
      statsOf({
        halfSeason: { id: 10, label: 'Season 10', startsAt: null, endsAt: null },
        inPlaceOf: { id: 10.5, label: 'Season 10.5', startsAt: null, endsAt: null },
      }),
    );

    expect(view.halfSeasonLabel).toBe('Season 10');
    expect(view.notice).toContain('Season 10.5 does not have enough data yet');
    expect(ready(statsOf()).notice).toBeNull();
  });

  it('is the empty state, naming the minimum and the most any role has, when nothing is ready', () => {
    const summary = summaryOf(
      statsOf({
        status: 'not-enough-data',
        modes: [
          {
            id: 'all',
            label: 'All',
            roles: [role('Vanguard', { appearances: 12 }), role('Duelist', { appearances: 40 }), role('Strategist')],
          },
        ],
      }),
    );

    expect(summary).toContain('50 lines');
    expect(summary).toContain('40 lines');
  });

  it('is the empty state with no lines at all, never "0 lines" or NaN', () => {
    const summary = summaryOf(statsOf({ status: 'not-enough-data', halfSeason: null, modes: [] }));

    expect(summary).toContain('50 lines');
    expect(summary).not.toMatch(/NaN|undefined|(^|\s)0(\s|$)/);
  });
});
