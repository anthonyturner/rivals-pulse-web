import type { SupabaseClient } from '@supabase/supabase-js';

import type { CommunityInsights } from '../../../contracts/community-insights.model.ts';
import { deriveCommunityInsights, type InsightsBucketRow, type InsightsSource } from './community-insights.ts';
import { answerReader, callReadFunction, getSupabaseClient } from '../../supabase/index.ts';

interface CommunityInsightsReadOptions {
  /** Defaults to the shared server client. */
  getClient?: () => Pick<SupabaseClient, 'rpc'>;
}

const READ_FUNCTION = 'read_community_insights';
const { answerOf, recordsOf, numberOf, stringOf } = answerReader(READ_FUNCTION);

/**
 * The Insights tab's numbers. `read_community_insights()` is the only door to the aggregates, and it
 * is open to the service role alone, so this reads with the shared server client through
 * `callReadFunction`, and parses the answer with the same `answerReader` as the hero readers.
 *
 * A function or table that does not exist yet (the migration is applied by hand) is the designed
 * "not enough data yet" state. Every other failure (a refused key, a server error, a timeout, a
 * missing variable) throws, so the endpoint answers an error status instead of hiding an outage.
 */
export async function getCommunityInsights(options: CommunityInsightsReadOptions = {}): Promise<CommunityInsights> {
  const client = (options.getClient ?? getSupabaseClient)();
  const body = await callReadFunction(client, READ_FUNCTION);

  return deriveCommunityInsights(body === null ? null : parseInsightsSource(body));
}

/** Picks the known fields out of the function's answer and rejects anything that is not a number. */
export function parseInsightsSource(body: unknown): InsightsSource {
  const payload = answerOf(body);

  return {
    sessionGapMinutes: numberOf(payload, 'session_gap_minutes'),
    minimumMatches: numberOf(payload, 'minimum_matches'),
    buckets: recordsOf(payload['buckets'], 'buckets').map(
      (row): InsightsBucketRow => ({
        dimension: stringOf(row, 'dimension'),
        bucket: numberOf(row, 'bucket'),
        sharePercent: numberOf(row, 'share_percent'),
        winRatePercent: row['win_rate_percent'] === null ? null : numberOf(row, 'win_rate_percent'),
      }),
    ),
  };
}
