import type { SupabaseClient } from '@supabase/supabase-js';

import type { CommunityInsights } from './contracts/community-insights.model.js';
import { deriveCommunityInsights, type InsightsBucketRow, type InsightsSource } from './community-insights.js';
import { getSupabaseClient } from './supabase-client.js';

export interface CommunityInsightsReadOptions {
  /** Defaults to the shared server client; called inside the read, so a client that cannot be made is an unavailable answer too. */
  getClient?: () => Pick<SupabaseClient, 'rpc'>;
}

const READ_FUNCTION = 'read_community_insights';
const READ_TIMEOUT_MS = 5000;

/**
 * The Insights tab's numbers. `read_community_insights()` is the only door to the aggregates: the
 * tables have no grant for any web role, and the function is open to the service role alone, which
 * is why this reads with the shared server client.
 *
 * It never throws. Before the migration is applied, with Supabase unconfigured or unreachable, or
 * on an answer of the wrong shape, the tab gets the designed "not enough data yet" state and the
 * cause goes to the log; a missing table must not become a failed page.
 */
export async function getCommunityInsights(options: CommunityInsightsReadOptions = {}): Promise<CommunityInsights> {
  try {
    const client = (options.getClient ?? getSupabaseClient)();
    const { data, error } = await client.rpc(READ_FUNCTION).abortSignal(AbortSignal.timeout(READ_TIMEOUT_MS));

    if (error) {
      throw new Error(`${READ_FUNCTION} answered ${error.code || 'an error'}: ${error.message}`);
    }

    return deriveCommunityInsights(parseInsightsSource(data));
  } catch (error) {
    console.warn(
      'Community insights unavailable, answering not enough data:',
      error instanceof Error ? error.message : error,
    );

    return deriveCommunityInsights(null);
  }
}

/** Picks the known fields out of the function's answer and rejects anything that is not a number. */
export function parseInsightsSource(body: unknown): InsightsSource {
  const payload = recordOf(body, READ_FUNCTION);
  const buckets = payload['buckets'];

  if (!Array.isArray(buckets)) {
    throw new Error(`${READ_FUNCTION}: buckets is not a list`);
  }

  return {
    sessionGapMinutes: numberOf(payload, 'session_gap_minutes'),
    buckets: buckets.map((entry): InsightsBucketRow => {
      const row = recordOf(entry, `${READ_FUNCTION}: a bucket`);

      return {
        halfSeason: numberOf(row, 'half_season'),
        dimension: stringOf(row, 'dimension'),
        bucket: numberOf(row, 'bucket'),
        matches: numberOf(row, 'matches'),
        decidedMatches: numberOf(row, 'decided_matches'),
        wins: numberOf(row, 'wins'),
        recorders: numberOf(row, 'recorders'),
      };
    }),
  };
}

function recordOf(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${what} is not an object`);
  }

  return value as Record<string, unknown>;
}

function numberOf(row: Record<string, unknown>, key: string): number {
  const value = row[key];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${READ_FUNCTION}: ${key} is not a number`);
  }

  return value;
}

function stringOf(row: Record<string, unknown>, key: string): string {
  const value = row[key];

  if (typeof value !== 'string') {
    throw new Error(`${READ_FUNCTION}: ${key} is not a string`);
  }

  return value;
}
