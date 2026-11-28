import { activityOf } from '../../../core/auth/own-dashboard.fixtures';
import { ownActivityRows, ownInsightTables, ownMatchTables } from './own-activity';

describe('ownActivityRows', () => {
  it('labels a win rate and leaves a row with no result empty', () => {
    expect(
      ownActivityRows([
        { label: 'A', matches: 4, wins: 3, losses: 1, winRate: 0.75 },
        { label: 'B', matches: 1, wins: 0, losses: 0, winRate: null },
      ]),
    ).toEqual([
      { label: 'A', matches: 4, winRate: '75%', barPercent: 75 },
      { label: 'B', matches: 1, winRate: 'No results', barPercent: 0 },
    ]);
  });
});

describe('ownMatchTables', () => {
  it('lists maps, modes and days, naming each day as a date', () => {
    const [maps, modes, days] = ownMatchTables(activityOf('Tokyo 2099'));

    expect([maps.title, modes.title, days.title]).toEqual([
      'Win rate by map',
      'Game modes played',
      'Your last 30 days played',
    ]);
    expect(maps.rows.map((row) => row.label)).toEqual(['Tokyo 2099']);
    expect(modes.rows.map((row) => row.label)).toEqual(['Quick Match']);
    expect(days.rows.map((row) => row.label)).toEqual(['Thu 29 Oct']);
  });

  it('keeps a table with no rows, so the page can say it is empty', () => {
    const empty = { maps: [], modes: [], days: [], weekdays: [], timesOfDay: [], sessionPlaces: [] };

    expect(ownMatchTables(empty).map((table) => table.rows)).toEqual([[], [], []]);
  });
});

describe('ownInsightTables', () => {
  it('lists weekdays, times of day and places in a play session', () => {
    const tables = ownInsightTables(activityOf('Tokyo 2099'));

    expect(tables.map((table) => table.title)).toEqual(['Day of the week', 'Time of day', 'Place in a play session']);
    expect(tables.map((table) => table.rows[0].label)).toEqual(['Thursday', '08:00 to 11:59', 'Match 1']);
  });
});
