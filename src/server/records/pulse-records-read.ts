import type { SupabaseClient } from '@supabase/supabase-js';

import {
  PULSE_RECORD_CATEGORIES,
  type PulseRecord,
  type PulseRecords,
  type PulseRecordsCategory,
} from '../../contracts/pulse-records.model.ts';
import { answerReader, getSupabaseClient } from '../supabase/index.ts';

interface PulseRecordsReadOptions {
  /** Defaults to the shared server client. */
  getClient?: () => Pick<SupabaseClient, 'rpc'>;
}

const READ_FUNCTION = 'read_pulse_records';
const READ_TIMEOUT_MS = 5000;
const { answerOf, recordsOf, numberOf, stringOf } = answerReader(READ_FUNCTION);

/** PGRST202 (HTTP 404), 42883 and 42P01 mean the migration has not been applied yet. */
const NOT_DEPLOYED_CODES = new Set(['PGRST202', '42883', '42P01']);

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
  const { data, error } = await client.rpc(READ_FUNCTION).abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS));

  if (error) {
    if (NOT_DEPLOYED_CODES.has(error.code)) {
      console.warn(`${READ_FUNCTION} is not deployed yet, answering no records`);

      return emptyPulseRecords();
    }

    throw new Error(`${READ_FUNCTION} answered ${error.code || 'an error'}: ${error.message}`);
  }

  return parsePulseRecords(data);
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
  return {
    heroId: numberOf(row, 'heroId'),
    value: numberOf(row, 'value'),
    name: row['name'] === null ? null : cleanName(stringOf(row, 'name')),
  };
}

function cleanName(name: string): string | null {
  return name.replace(UNSAFE_NAME_CHARACTERS, '').trim() || null;
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
