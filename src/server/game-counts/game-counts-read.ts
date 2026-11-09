import type { SupabaseClient } from '@supabase/supabase-js';

import type { GameCounts } from '../../contracts/game-counts.model.ts';
import { aggregatePayloadReader } from '../community/aggregate-payload.ts';
import { getSupabaseClient } from '../supabase/index.ts';

const READ_FUNCTION = 'read_game_counts';
const READ_TIMEOUT_MS = 5000;

// What Postgres and PostgREST answer when the migration has not been applied yet: PGRST202 is "no
// such function in the schema cache", 42883 an undefined function and 42P01 an undefined table.
const NOT_APPLIED_CODES: ReadonlySet<string> = new Set(['PGRST202', '42883', '42P01']);

const NOTHING_COUNTED: GameCounts = { matches: 0, players: 0, since: null, halfSeasons: [] };

const reader = aggregatePayloadReader(READ_FUNCTION);

/**
 * Calls `public.read_game_counts()` with the server's service-role client. The function is granted to
 * that role alone and returns counts only. Resolves to the empty counts while the migration is not
 * applied, so the page shows its empty state rather than failing.
 */
export async function getGameCounts(client: SupabaseClient = getSupabaseClient()): Promise<GameCounts> {
  const { data, error } = await client
    .rpc(READ_FUNCTION)
    .retry(false)
    .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS));

  if (error) {
    if (error.code !== undefined && NOT_APPLIED_CODES.has(error.code)) {
      console.warn(`${READ_FUNCTION} is not in the database yet; the game counts show the empty state`);

      return NOTHING_COUNTED;
    }

    throw new Error(`${READ_FUNCTION} failed${error.code ? ` (${error.code})` : ''}: ${error.message}`);
  }

  return parseGameCounts(data);
}

/** Picks the known fields out of the function's answer and rejects anything that is not a number. */
export function parseGameCounts(body: unknown): GameCounts {
  const payload = reader.object(body, 'the answer');

  return {
    matches: reader.number(payload, 'matches'),
    players: reader.number(payload, 'players'),
    since: sinceOf(payload['since']),
    halfSeasons: reader.list(payload['half_seasons'], 'half_seasons').map((row) => ({
      halfSeason: reader.number(row, 'half_season'),
      matches: reader.number(row, 'matches'),
      players: reader.number(row, 'players'),
    })),
  };
}

/** Postgres writes a timestamptz as `2026-09-20T02:12:49+00:00`; the API gives the `toISOString()` form. */
function sinceOf(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  const time = typeof value === 'string' ? Date.parse(value) : Number.NaN;

  if (Number.isNaN(time)) {
    throw new Error(`${READ_FUNCTION}: since is not a timestamp`);
  }

  return new Date(time).toISOString();
}
