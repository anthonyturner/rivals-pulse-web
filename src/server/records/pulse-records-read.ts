import type { SupabaseClient } from '@supabase/supabase-js';

import {
  PULSE_RECORD_CATEGORIES,
  type PulseRecord,
  type PulseRecords,
  type PulseRecordsCategory,
} from '../../contracts/pulse-records.model.ts';
import { heroSlugByGameId } from '../heroes/catalog/hero-game-ids.ts';
import { answerReader, callReadFunction, getSupabaseClient } from '../supabase/index.ts';

interface PulseRecordsReadOptions {
  /** Defaults to the shared server client. */
  getClient?: () => Pick<SupabaseClient, 'rpc'>;
}

const READ_FUNCTION = 'read_pulse_records';
const { answerOf, recordsOf, numberOf, stringOf } = answerReader(READ_FUNCTION);

/**
 * Control characters, then the invisible ones that reorder or hide text. The database already strips
 * them from a link's name; this is the second line, so a name can never flip the text around it.
 */
const UNSAFE_NAME_CHARACTERS = /[\u0000-\u001f\u007f-\u009f\u061c\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff]/g;

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The Pulse Records boards. `read_pulse_records()` is the only door to them and is open to the
 * service role alone, so this reads with the shared server client. It applies every rule about who
 * may be named; this function only shapes the answer.
 *
 * A function that does not exist yet is the designed empty state. Every other failure (a refused
 * key, a server error, a timeout, a missing variable) throws, so the endpoint answers an error status
 * instead of hiding an outage behind "no records yet".
 */
export async function getPulseRecords(options: PulseRecordsReadOptions = {}): Promise<PulseRecords> {
  const client = (options.getClient ?? getSupabaseClient)();
  const body = await callReadFunction(client, READ_FUNCTION);

  return body === null ? emptyPulseRecords() : parsePulseRecords(body);
}

export function emptyPulseRecords(): PulseRecords {
  return { status: 'not-enough-data', coveredFrom: null, categories: categoriesFrom(new Map()) };
}

/**
 * Picks the known fields out of the function's answer. A category the server does not know is
 * ignored; one the answer lacks is empty; a field of the wrong type fails the request.
 */
export function parsePulseRecords(body: unknown): PulseRecords {
  const payload = answerOf(body);
  const rowsByKey = new Map<string, PulseRecord[]>();

  for (const category of recordsOf(payload['categories'], 'categories')) {
    rowsByKey.set(stringOf(category, 'key'), recordsOf(category['rows'], 'rows').map(parseRecord));
  }

  const categories = categoriesFrom(rowsByKey);

  return {
    status: categories.some((category) => category.rows.length > 0) ? 'ready' : 'not-enough-data',
    coveredFrom: parseCoveredFrom(payload['coveredFrom']),
    categories,
  };
}

function categoriesFrom(rowsByKey: ReadonlyMap<string, PulseRecord[]>): PulseRecordsCategory[] {
  return PULSE_RECORD_CATEGORIES.map(({ key, title }) => ({ key, title, rows: rowsByKey.get(key) ?? [] }));
}

function parseRecord(row: Record<string, unknown>): PulseRecord {
  const heroId = numberOf(row, 'heroId');

  return {
    heroId,
    hero: heroSlugByGameId.get(heroId) ?? null,
    value: numberOf(row, 'value'),
    name: row['name'] === null ? null : cleanName(stringOf(row, 'name')),
  };
}

/**
 * A name that is empty once cleaned is an error, not an anonymous row: the database leaves such a
 * linked player off the board, so one arriving here means the two cleaners disagree.
 */
function cleanName(name: string): string {
  const cleaned = name.replace(UNSAFE_NAME_CHARACTERS, '').trim();

  if (cleaned === '') {
    throw new Error(`${READ_FUNCTION}: a name is empty once cleaned`);
  }

  return cleaned;
}

function parseCoveredFrom(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string' || !CALENDAR_DAY.test(value)) {
    throw new Error(`${READ_FUNCTION}: coveredFrom is not a calendar day`);
  }

  return value;
}
