import type { SupabaseClient } from '@supabase/supabase-js';

import {
  deriveCommunityMatches,
  type CommunityMatchesSource,
} from './community-matches.ts';
import type { CommunityMatches } from '../../../contracts/community-matches.model.ts';
import type { GameCounts } from '../../../contracts/game-counts.model.ts';
import { getGameCounts } from '../../game-counts/game-counts-read.ts';
import { answerReader, callReadFunction, getSupabaseClient } from '../../supabase/index.ts';

interface CommunityMatchesReadOptions {
  client?: SupabaseClient;
  now?: () => Date;
  /** One exact half-season instead of the current one; see `DeriveCommunityMatchesOptions`. */
  halfSeason?: number;
}

const READ_FUNCTION = 'read_community_matches';

const NOTHING_COUNTED: CommunityMatchesSource = { halfSeasons: [], modes: [], maps: [], days: [] };

const reader = answerReader(READ_FUNCTION);

/**
 * Reads `public.read_community_matches()`, which is granted to the service role alone; the aggregate
 * tables behind it hold counts only. Resolves to null while the migration is not applied, so the tab
 * shows its empty state rather than failing.
 */
export async function fetchCommunityMatchesSource(
  client: SupabaseClient,
): Promise<CommunityMatchesSource | null> {
  const body = await callReadFunction(client, READ_FUNCTION);

  return body === null ? null : parseCommunityMatchesSource(body);
}

/** Picks the known fields out of the function's answer and rejects anything that is not a number. */
export function parseCommunityMatchesSource(body: unknown): CommunityMatchesSource {
  const payload = reader.answerOf(body);

  return {
    halfSeasons: reader.recordsOf(payload['half_seasons'], 'half_seasons').map((row) => ({
      halfSeason: reader.numberOf(row, 'half_season'),
      startsAt: reader.stringOf(row, 'starts_at'),
    })),
    modes: reader.recordsOf(payload['modes'], 'modes').map((row) => ({
      halfSeason: reader.numberOf(row, 'half_season'),
      playModeId: reader.numberOf(row, 'play_mode_id'),
      matches: reader.numberOf(row, 'matches'),
      durationSumSeconds: reader.numberOf(row, 'duration_sum_seconds'),
      durationN: reader.numberOf(row, 'duration_n'),
    })),
    maps: reader.recordsOf(payload['maps'], 'maps').map((row) => ({
      halfSeason: reader.numberOf(row, 'half_season'),
      playModeId: reader.numberOf(row, 'play_mode_id'),
      mapName: reader.stringOf(row, 'map_name'),
      matches: reader.numberOf(row, 'matches'),
      decidedMatches: reader.numberOf(row, 'decided_matches'),
      wins: reader.numberOf(row, 'wins'),
    })),
    days: reader.recordsOf(payload['days'], 'days').map((row) => ({
      halfSeason: reader.numberOf(row, 'half_season'),
      day: dayOf(reader.stringOf(row, 'day')),
      matches: reader.numberOf(row, 'matches'),
    })),
  };
}

/** The community's match figures, or the empty state while the aggregates are not there yet. */
export async function getCommunityMatches(options: CommunityMatchesReadOptions = {}): Promise<CommunityMatches> {
  const client = options.client ?? getSupabaseClient();
  const [source, counts] = await Promise.all([fetchCommunityMatchesSource(client), readGameCounts(client)]);

  return deriveCommunityMatches(source ?? NOTHING_COUNTED, {
    now: (options.now ?? (() => new Date()))(),
    halfSeason: options.halfSeason,
    counts,
  });
}

/**
 * The counts behind the "matches counted" figure, or null when they cannot be read. The tab's other
 * figures do not depend on them, so a failed read costs it the one figure, not the whole tab.
 */
async function readGameCounts(client: SupabaseClient): Promise<GameCounts | null> {
  try {
    return await getGameCounts(client);
  } catch (error) {
    console.error('Failed to read the game counts for the matches-counted figure', error);

    return null;
  }
}

function dayOf(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${READ_FUNCTION}: day is not a calendar day`);
  }

  return value;
}
