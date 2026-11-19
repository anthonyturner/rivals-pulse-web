import type { OwnDashboardLine } from './own-dashboard.ts';
import { deriveOwnActivity } from './own-activity.ts';

function line(overrides: Partial<OwnDashboardLine>): OwnDashboardLine {
  return {
    playedAt: '2026-11-02T10:00:00Z',
    heroId: null,
    kills: null,
    deaths: null,
    assists: null,
    finalHits: null,
    isWin: null,
    playModeId: 0,
    mapName: 'Tokyo 2099',
    figures: [],
    ...overrides,
  };
}

describe('deriveOwnActivity', () => {
  it('counts a map over the ranked modes, reading a blank result as neither a win nor a loss', () => {
    const { maps } = deriveOwnActivity([
      line({ isWin: true }),
      line({ isWin: false, playModeId: 1 }),
      line({ isWin: null }),
      line({ isWin: true, playModeId: 3 }),
      line({ mapName: null }),
    ]);

    expect(maps).toEqual([{ label: 'Tokyo 2099', matches: 3, wins: 1, losses: 1, winRate: 0.5 }]);
  });

  it('counts every mode in the mode table, and calls an unstated one Other', () => {
    const { modes } = deriveOwnActivity([line({}), line({}), line({ playModeId: 3 }), line({ playModeId: null })]);

    expect(modes.map((row) => [row.label, row.matches])).toEqual([
      ['Quick Match', 2],
      ['Other', 1],
      ['Practice', 1],
    ]);
  });

  it('places matches by UTC weekday and four-hour block', () => {
    const { weekdays, timesOfDay } = deriveOwnActivity([line({ playedAt: '2026-11-02T23:30:00Z' })]);

    expect(weekdays.map((row) => row.label)).toEqual(['Monday']);
    expect(timesOfDay.map((row) => row.label)).toEqual(['20:00 to 23:59']);
  });

  it('starts a new session after a long gap and groups the fourth match on', () => {
    const { sessionPlaces } = deriveOwnActivity(
      ['10:00', '10:15', '10:30', '10:45', '11:00', '13:00'].map((time) =>
        line({ playedAt: `2026-11-02T${time}:00Z` }),
      ),
    );

    expect(sessionPlaces.map((row) => [row.label, row.matches])).toEqual([
      ['Match 1', 2],
      ['Match 2', 1],
      ['Match 3', 1],
      ['Match 4 or later', 2],
    ]);
  });

  it('keeps a day in UTC and counts only the ranked modes in it', () => {
    const { days, weekdays } = deriveOwnActivity([
      line({ playedAt: '2026-11-02T23:30:00-05:00' }),
      line({ playedAt: '2026-11-03T10:00:00Z', playModeId: 3 }),
    ]);

    expect(days.map((row) => [row.label, row.matches])).toEqual([['2026-11-03', 1]]);
    expect(weekdays.map((row) => row.label)).toEqual(['Tuesday']);
  });

  it('lists the newest day first and answers empty lists for no matches', () => {
    const { days } = deriveOwnActivity([
      line({ playedAt: '2026-11-01T10:00:00Z' }),
      line({ playedAt: '2026-11-02T10:00:00Z' }),
    ]);

    expect(days.map((row) => row.label)).toEqual(['2026-11-02', '2026-11-01']);
    expect(deriveOwnActivity([])).toEqual({
      maps: [],
      modes: [],
      days: [],
      weekdays: [],
      timesOfDay: [],
      sessionPlaces: [],
    });
  });
});
