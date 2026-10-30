import type { SupabaseClient } from '@supabase/supabase-js';

import type { CommunityInsights } from './contracts/community-insights.model.js';
import { deriveCommunityInsights, type InsightsBucketRow, type InsightsSource } from './community-insights.js';
import { getSupabaseClient } from './supabase-client.js';
import { answerReader } from './supabase-rpc.js';

export interface CommunityInsightsReadOptions {
  /** Defaults to the shared server client. */
  getClient?: () => Pick<SupabaseClient, 'rpc'>;
}

const READ_FUNCTION = 'read_community_insights';
const READ_TIMEOUT_MS = 5000;
const { answerOf, recordsOf, numberOf, stringOf } = answerReader(READ_FUNCTION);

/**
 * PostgREST answers PGRST202 (HTTP 404) for a function it does not know, and Postgres 42883 / 42P01
 * for a missing function or table. They mean the migration has not been applied yet.
 */
const NOT_DEPLOYED_CODES = new Set(['PGRST202', '42883', '42P01']);

/**
 * The Insights tab's numbers. `read_community_insights()` is the only door to the aggregates, and it
 * is open to the service role alone, so this reads with the shared server client. The shared
 * publishable-key reader (`supabase-rpc.ts`) cannot reach it, which is why this keeps its own call;
 * the answer is parsed with the same `answerReader` as the hero readers.
 *
 * A function or table that does not exist yet (the migration is applied by hand) is the designed
 * "not enough data yet" state. Every other failure (a refused key, a server error, a timeout, a
 * missing variable) throws, so the endpoint answers an error status instead of hiding an outage.
 */
export async function getCommunityInsights(options: CommunityInsightsReadOptions = {}): Promise<CommunityInsights> {
  const client = (options.getClient ?? getSupabaseClient)();
  const { data, error } = await client.rpc(READ_FUNCTION).abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS));

  if (error) {
    if (NOT_DEPLOYED_CODES.has(error.code)) {
      console.warn(`${READ_FUNCTION} is not deployed yet, answering not enough data`);

      return deriveCommunityInsights(null);
    }

    throw new Error(`${READ_FUNCTION} answered ${error.code || 'an error'}: ${error.message}`);
  }

  return deriveCommunityInsights(parseInsightsSource(data));
}

/** Picks the known fields out of the function's answer and rejects anything that is not a number. */
export function parseInsightsSource(body: unknown): InsightsSource {
  const payload = answerOf(body);

  return {
    sessionGapMinutes: numberOf(payload, 'session_gap_minutes'),
    minimumMatches: numberOf(payload, 'minimum_matches'),
    minimumRecorders: numberOf(payload, 'minimum_recorders'),
    maxRecorderSharePercent: numberOf(payload, 'max_recorder_share_percent'),
    buckets: recordsOf(payload['buckets'], 'buckets').map(
      (row): InsightsBucketRow => ({
        dimension: stringOf(row, 'dimension'),
        bucket: numberOf(row, 'bucket'),
        matches: numberOf(row, 'matches'),
        decidedMatches: numberOf(row, 'decided_matches'),
        wins: numberOf(row, 'wins'),
      }),
    ),
  };
}
