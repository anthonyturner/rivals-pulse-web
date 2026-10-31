import type { HeroStatsModeId } from '../../../../contracts/hero-stats.model';
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

function ready(stats: RoleStats, mode: HeroStatsModeId = 'all') {
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

  it('lists the modes that hold lines, marks the chosen one, and falls back to the first for an unknown mode', () => {
    expect(ready(statsOf()).modes.map((mode) => [mode.id, mode.selected])).toEqual([
      ['all', true],
      ['quick-match', false],
    ]);
    expect(ready(statsOf(), 'nonsense' as HeroStatsModeId).modes[0].selected).toBeTrue();
    expect(ready(statsOf(), 'quick-match').cards[0].appearancesLabel).toBe('30 lines');
  });

  it('keeps the chosen mode on the switch even when it holds no lines, so it can be left', () => {
    const view = ready(statsOf(), 'competitive');

    expect(view.modes.map((mode) => [mode.id, mode.selected])).toEqual([
      ['all', false],
      ['quick-match', false],
      ['competitive', true],
    ]);
    expect(view.cards.every((card) => !card.ready)).toBeTrue();
  });

  it('leaves out Arcade and Practice buttons until they hold lines, and Practice while it is held back', () => {
    const withLines = (id: 'arcade' | 'practice', label: string): RoleStats['modes'][number] => ({
      id,
      label,
      roles: [role('Vanguard', { appearances: 4 }), role('Duelist'), role('Strategist')],
    });
    const empty = (id: 'arcade' | 'practice', label: string): RoleStats['modes'][number] => ({
      id,
      label,
      roles: [role('Vanguard'), role('Duelist'), role('Strategist')],
    });
    const offeredIds = (stats: RoleStats): string[] => ready(stats).modes.map((mode) => mode.id);
    const base = statsOf().modes;

    expect(offeredIds(statsOf({ modes: [...base, empty('arcade', 'Arcade'), empty('practice', 'Practice')] }))).toEqual([
      'all',
      'quick-match',
    ]);
    expect(offeredIds(statsOf({ modes: [...base, withLines('arcade', 'Arcade'), withLines('practice', 'Practice')] }))).toEqual([
      'all',
      'quick-match',
      'arcade',
    ]);
  });

  it('draws no mode switch when only the default blend holds lines', () => {
    const [blend] = statsOf().modes;

    expect(ready(statsOf({ modes: [blend] })).modes).toEqual([]);
  });

  it('names the mode when a role is short of lines in one mode alone', () => {
    const [, duelist] = ready(statsOf(), 'quick-match').cards;

    expect(ready(statsOf(), 'quick-match').cards[0].message).toBe(
      'Not enough data yet in Quick Match: 30 of 50 lines.',
    );
    expect(duelist.message).toBe('Not enough data yet in Quick Match: no lines recorded so far.');
  });

  it('warns that Arcade is not comparable with the other modes', () => {
    const arcade: RoleStats['modes'][number] = {
      id: 'arcade',
      label: 'Arcade',
      roles: [role('Vanguard', { appearances: 4 }), role('Duelist'), role('Strategist')],
    };

    expect(ready(statsOf({ modes: [...statsOf().modes, arcade] }), 'arcade').caveat).toContain('Arcade');
    expect(ready(statsOf()).caveat).toBeNull();
  });

  it('no longer claims Arcade and Practice are left out, since a mode shows once it has lines', () => {
    expect(ready(statsOf()).sample).not.toMatch(/Practice|Arcade/);
    expect(ready(statsOf()).sample).toContain('no recorded mode are left out');
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

  it('counts only the modes on offer when saying the most any role has', () => {
    const summary = summaryOf(
      statsOf({
        status: 'not-enough-data',
        modes: [
          { id: 'all', label: 'All', roles: [role('Vanguard', { appearances: 12 }), role('Duelist'), role('Strategist')] },
          { id: 'practice', label: 'Practice', roles: [role('Vanguard', { appearances: 49 }), role('Duelist'), role('Strategist')] },
        ],
      }),
    );

    expect(summary).toContain('12 lines');
    expect(summary).not.toContain('49 lines');
  });

  it('is the empty state with no lines at all, never "0 lines" or NaN', () => {
    const summary = summaryOf(statsOf({ status: 'not-enough-data', halfSeason: null, modes: [] }));

    expect(summary).toContain('50 lines');
    expect(summary).not.toMatch(/NaN|undefined|(^|\s)0(\s|$)/);
  });
});
