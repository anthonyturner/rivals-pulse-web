import { PULSE_RECORDS_BOARD_SIZE, type PulseRecord, type PulseRecords } from '../../../contracts/pulse-records.model';
import { type HeroIdentities, heroCell } from '../insights/hero-identity';
import { PULSE_RECORDS_PAGES, type PulseRecordsPage } from './pulse-records.data';

/**
 * A board is shown only from this many rows. The read keeps one row per uploader per board, so a
 * board's row count is also its count of distinct uploaders (a board holds up to 50 rows, well past
 * this). With fewer, one account could put up the whole board, so the page says "not enough data yet".
 */
export const PULSE_RECORDS_MIN_ROWS = 5;

/** The rows `/records` shows for each board. */
export const PULSE_RECORDS_PREVIEW_ROWS = 5;

export interface RecordRowView {
  place: number;
  /** Null when the game's hero id is not on the roster: the row is kept, with a blank tile. */
  hero: { name: string; imageUrl: string } | null;
  /** Null for an anonymous line. */
  player: string | null;
  value: string;
}

export interface RecordBoardView {
  page: PulseRecordsPage;
  /** The id of the board's heading, which names its table. */
  headingId: string;
  /** False while the board has too few rows to be shown. */
  shown: boolean;
  rows: RecordRowView[];
}

export interface RecordsView {
  boards: RecordBoardView[];
  /** False when no board passes the gate, which the pages treat as one "not enough data yet" state. */
  anyShown: boolean;
  /** "Matches since" date, long form, or null when no board is shown. */
  since: string | null;
}

/** The boards of an answer as the pages draw them, each cut to `rowLimit` rows. */
export function buildRecordsView(
  records: PulseRecords,
  identities: HeroIdentities,
  rowLimit: number = PULSE_RECORDS_BOARD_SIZE,
): RecordsView {
  const boards = PULSE_RECORDS_PAGES.map((page): RecordBoardView => {
    const rows = records.categories.find((category) => category.key === page.key)?.rows ?? [];
    const shown = rows.length >= PULSE_RECORDS_MIN_ROWS;

    return {
      page,
      headingId: `board-${page.slug}`,
      shown,
      rows: shown ? rows.slice(0, rowLimit).map((row, index) => rowView(row, index + 1, identities)) : [],
    };
  });
  const anyShown = boards.some((board) => board.shown);

  return { boards, anyShown, since: anyShown ? formatDay(records.coveredFrom) : null };
}

function rowView(row: PulseRecord, place: number, identities: HeroIdentities): RecordRowView {
  const hero = row.hero === null ? null : heroCell(row.hero, identities);

  return {
    place,
    hero: hero && { name: hero.name, imageUrl: hero.imageUrl },
    player: row.name,
    value: row.value.toLocaleString('en-US'),
  };
}

/** `2026-09-20` as "September 20, 2026", read as a UTC day so it does not move with the visitor's time zone. */
export function formatDay(day: string | null): string | null {
  const date = day === null ? null : new Date(`${day}T00:00:00Z`);

  if (date === null || Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(date);
}
