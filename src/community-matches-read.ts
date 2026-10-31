import type { SupabaseClient } from '@supabase/supabase-js';

import { aggregatePayloadReader } from './aggregate-payload.js';
import {
  deriveCommunityMatches,
  type CommunityMatchesSource,
} from './community-matches.js';
import type { CommunityMatches } from './contracts/community-matches.model.js';
import { getSupabaseClient } from './supabase-client.js';

export interface CommunityMatchesReadOptions {
  client?: SupabaseClient;
  now?: () => Date;
  /** One exact half-season instead of the current one; see `DeriveCommunityMatchesOptions`. */
  halfSeason?: number;
}

const READ_FUNCTION = 'read_community_matches';
const READ_TIMEOUT_MS = 5000;

// What Postgres and PostgREST answer when the migration has not been applied yet: PGRST202 is "no
// such function in the schema cache", 42883 an undefined function and 42P01 an undefined table.
const NOT_APPLIED_CODES: ReadonlySet<string> = new Set(['PGRST202', '42883', '42P01']);

const NOTHING_COUNTED: CommunityMatchesSource = { halfSeasons: [], modes: [], maps: [], days: [] };

const reader = aggregatePayloadReader(READ_FUNCTION);

/**
 * Calls `public.read_community_matches()` with the server's service-role client. The function is
 * granted to that role alone, and the aggregate tables behind it hold counts only. Resolves to null
 * while the migration is not applied, so the tab shows its empty state rather than failing.
 */
export async function fetchCommunityMatchesSource(
  client: SupabaseClient,
): Promise<CommunityMatchesSource | null> {
  const { data, error } = await client
    .rpc(READ_FUNCTION)
    .retry(false)
    .abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS));

  if (error) {
    if (error.code !== undefined && NOT_APPLIED_CODES.has(error.code)) {
      return null;
    }

    throw new Error(`${READ_FUNCTION} failed${error.code ? ` (${error.code})` : ''}: ${error.message}`);
  }

  return parseCommunityMatchesSource(data);
}

/** Picks the known fields out of the function's answer and rejects anything that is not a number. */
export function parseCommunityMatchesSource(body: unknown): CommunityMatchesSource {
  const payload = reader.object(body, 'the answer');

  return {
    halfSeasons: reader.list(payload['half_seasons'], 'half_seasons').map((row) => ({
      halfSeason: reader.number(row, 'half_season'),
      startsAt: reader.string(row, 'starts_at'),
    })),
    modes: reader.list(payload['modes'], 'modes').map((row) => ({
      halfSeason: reader.number(row, 'half_season'),
      playModeId: reader.number(row, 'play_mode_id'),
      matches: reader.number(row, 'matches'),
      durationSumSeconds: reader.number(row, 'duration_sum_seconds'),
      durationN: reader.number(row, 'duration_n'),
    })),
    maps: reader.list(payload['maps'], 'maps').map((row) => ({
      halfSeason: reader.number(row, 'half_season'),
      playModeId: reader.number(row, 'play_mode_id'),
      mapName: reader.string(row, 'map_name'),
      matches: reader.number(row, 'matches'),
      decidedMatches: reader.number(row, 'decided_matches'),
      wins: reader.number(row, 'wins'),
    })),
    days: reader.list(payload['days'], 'days').map((row) => ({
      halfSeason: reader.number(row, 'half_season'),
      day: dayOf(reader.string(row, 'day')),
      matches: reader.number(row, 'matches'),
    })),
  };
}

/** The community's match figures, or the empty state while the aggregates are not there yet. */
export async function getCommunityMatches(options: CommunityMatchesReadOptions = {}): Promise<CommunityMatches> {
  const source = await fetchCommunityMatchesSource(options.client ?? getSupabaseClient());

  if (source === null) {
    console.warn(`${READ_FUNCTION} is not available yet: the community match aggregates are not applied.`);
  }

  return deriveCommunityMatches(source ?? NOTHING_COUNTED, {
    now: (options.now ?? (() => new Date()))(),
    halfSeason: options.halfSeason,
  });
}

function dayOf(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${READ_FUNCTION}: day is not a calendar day`);
  }

  return value;
}
