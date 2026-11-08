import { PULSE_RECORD_CATEGORIES, type PulseRecord, type PulseRecords } from '../../../contracts/pulse-records.model';

/** Fixtures the Pulse Records specs share; nothing imports this outside a spec. */

/** `count` lines on one board, best first, every second one named. */
export function recordRows(count: number, topValue: number = 40): PulseRecord[] {
  const heroes = ['hulk', 'storm', 'mantis', null];

  return Array.from({ length: count }, (_, index) => ({
    heroId: 1000 + index,
    hero: heroes[index % heroes.length],
    value: topValue - index,
    name: index % 2 === 0 ? null : `Player ${index}`,
  }));
}

/** The answer of `/api/records`, with the rows given for each board and the rest empty. */
export function recordsOf(
  rowsByKey: Partial<Record<(typeof PULSE_RECORD_CATEGORIES)[number]['key'], PulseRecord[]>>,
  coveredFrom: string | null = '2026-09-20',
): PulseRecords {
  const categories = PULSE_RECORD_CATEGORIES.map(({ key, title }) => ({ key, title, rows: rowsByKey[key] ?? [] }));

  return {
    status: categories.some((category) => category.rows.length > 0) ? 'ready' : 'not-enough-data',
    coveredFrom,
    categories,
  };
}
