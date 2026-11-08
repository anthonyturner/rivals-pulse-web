import { heroIdentities } from '../insights/hero-identity';
import { recordRows, recordsOf } from './pulse-records.fixtures';
import {
  buildRecordsView,
  formatDay,
  PULSE_RECORDS_MIN_ROWS,
  PULSE_RECORDS_PREVIEW_ROWS,
} from './pulse-records-view';

const IDENTITIES = heroIdentities([
  { id: 'hulk', name: 'Hulk', role: 'Vanguard', imageUrl: '/hulk.png' },
  { id: 'storm', name: 'Storm', role: 'Duelist', imageUrl: null },
]);

describe('buildRecordsView', () => {
  it('shows a board only from the minimum number of rows, which is the minimum number of uploaders', () => {
    const view = buildRecordsView(
      recordsOf({ kills: recordRows(PULSE_RECORDS_MIN_ROWS), assists: recordRows(PULSE_RECORDS_MIN_ROWS - 1) }),
      IDENTITIES,
    );

    expect(PULSE_RECORDS_MIN_ROWS).toBe(5);
    expect(view.boards.map((board) => board.shown)).toEqual([true, false, false, false, false, false]);
    expect(view.boards[1].rows).toEqual([]);
    expect(view.anyShown).toBeTrue();
  });

  it('shows nothing, and no date, while every board is thin', () => {
    const view = buildRecordsView(recordsOf({ kills: recordRows(4) }), IDENTITIES);

    expect(view.anyShown).toBeFalse();
    expect(view.since).toBeNull();
  });

  it('cuts a board to the rows asked for and numbers them from 1', () => {
    const view = buildRecordsView(recordsOf({ kills: recordRows(30) }), IDENTITIES, PULSE_RECORDS_PREVIEW_ROWS);

    expect(view.boards[0].rows.map((row) => row.place)).toEqual([1, 2, 3, 4, 5]);
  });

  it('names the hero from the roster, falls back to its id, and keeps a line whose hero is unknown', () => {
    const [first, second, third, fourth] = buildRecordsView(recordsOf({ kills: recordRows(5) }), IDENTITIES).boards[0].rows;

    expect(first.hero).toEqual({ name: 'Hulk', imageUrl: '/hulk.png' });
    expect(second.hero?.name).toBe('Storm');
    expect(third.hero).toEqual({ name: 'Mantis', imageUrl: '/images/heroes/mantis.png' });
    expect(fourth.hero).toBeNull();
  });

  it('keeps an anonymous line anonymous and formats the figure', () => {
    const rows = buildRecordsView(recordsOf({ damage: recordRows(5, 31250) }), IDENTITIES).boards[3].rows;

    expect(rows[0]).toEqual(jasmine.objectContaining({ player: null, value: '31,250' }));
    expect(rows[1].player).toBe('Player 1');
  });

  it('dates the boards from the data', () => {
    expect(buildRecordsView(recordsOf({ kills: recordRows(5) }, '2026-09-20'), IDENTITIES).since).toBe('September 20, 2026');
  });
});

describe('formatDay', () => {
  it('reads the day as UTC, so it does not move with the visitor', () => {
    expect(formatDay('2026-01-01')).toBe('January 1, 2026');
  });

  it('is null for no day or one that is not a date', () => {
    expect(formatDay(null)).toBeNull();
    expect(formatDay('soon')).toBeNull();
  });
});
