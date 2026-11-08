/** The boards, in the order the database returns them. */
export const PULSE_RECORD_CATEGORIES = [
  { key: 'kills', title: 'Kills' },
  { key: 'assists', title: 'Assists' },
  { key: 'final_hits', title: 'Final Hits' },
  { key: 'damage', title: 'Damage' },
  { key: 'healing', title: 'Healing' },
  { key: 'blocked', title: 'Damage Blocked' },
] as const;

export type PulseRecordCategoryKey = (typeof PULSE_RECORD_CATEGORIES)[number]['key'];

/** The most rows a board carries. The database enforces it; the pages read it from here. */
export const PULSE_RECORDS_BOARD_SIZE = 50;

/**
 * One line on a board: the hero it was played on, the figure, and the player's name when they chose
 * to be named. A line carries no id of the player, the uploader or the match, and no time.
 */
export interface PulseRecord {
  heroId: number;
  /** The hero's id on this site (the `:id` of `/heroes/:id`), or null when the game's hero id is not on the roster. */
  hero: string | null;
  value: number;
  /** The linked player's name, or null for an anonymous line. */
  name: string | null;
}

export interface PulseRecordsCategory {
  key: PulseRecordCategoryKey;
  title: string;
  /** Best first, at most `PULSE_RECORDS_BOARD_SIZE`. */
  rows: PulseRecord[];
}

/**
 * The best single matches among those the desktop app uploaded in Quick Match and Competitive.
 *
 * `not-enough-data` is a designed state, not an error: no board has a line yet, or the database
 * function is not applied yet. Every category is present either way, so a page never has to guess.
 */
export interface PulseRecords {
  status: 'ready' | 'not-enough-data';
  /** The day (UTC, `YYYY-MM-DD`) of the oldest match the boards draw on, or null when there is none. */
  coveredFrom: string | null;
  categories: PulseRecordsCategory[];
}
