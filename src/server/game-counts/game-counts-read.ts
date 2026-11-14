import type { SupabaseClient } from '@supabase/supabase-js';

import type { GameCounts } from '../../contracts/game-counts.model.ts';
import { answerReader, callReadFunction, getSupabaseClient } from '../supabase/index.ts';

const READ_FUNCTION = 'read_game_counts';

const NOTHING_COUNTED: GameCounts = { matches: 0, players: 0, since: null, halfSeasons: [] };

const reader = answerReader(READ_FUNCTION);

/**
 * Reads `public.read_game_counts()`, which is granted to the service role alone and returns counts
 * only. Resolves to the empty counts while the migration is not applied, so the page shows its empty
 * state rather than failing.
 */
export async function getGameCounts(client: SupabaseClient = getSupabaseClient()): Promise<GameCounts> {
  const body = await callReadFunction(client, READ_FUNCTION);

  return body === null ? NOTHING_COUNTED : parseGameCounts(body);
}

/** Picks the known fields out of the function's answer and rejects anything that is not a number. */
export function parseGameCounts(body: unknown): GameCounts {
  const payload = reader.answerOf(body);

  return {
    matches: reader.numberOf(payload, 'matches'),
    players: reader.numberOf(payload, 'players'),
    since: sinceOf(payload['since']),
    halfSeasons: reader.recordsOf(payload['half_seasons'], 'half_seasons').map((row) => ({
      halfSeason: reader.numberOf(row, 'half_season'),
      matches: reader.numberOf(row, 'matches'),
      players: reader.numberOf(row, 'players'),
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
