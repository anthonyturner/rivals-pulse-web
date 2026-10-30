import { getCommunityInsights, parseInsightsSource } from './community-insights-read';
import { createSupabaseClient } from './supabase-client';

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test-only' };

/** What `read_community_insights()` answers, with extra keys that no allow-list should let through. */
function functionAnswer(): Record<string, unknown> {
  return {
    session_gap_minutes: 30,
    buckets: [
      {
        half_season: 10.5,
        dimension: 'weekday',
        bucket: 1,
        matches: 40,
        decided_matches: 36,
        wins: 18,
        recorders: 4,
        uid: 'secret-uid',
        name: 'a player',
        player_id: 7,
      },
    ],
  };
}

function clientAnswering(body: unknown, status = 200) {
  const fetcher = jasmine.createSpy('fetch').and.callFake(async () => new Response(JSON.stringify(body), { status }));

  return { client: createSupabaseClient(ENV, { fetch: fetcher }), fetcher };
}

describe('getCommunityInsights', () => {
  beforeEach(() => {
    spyOn(console, 'warn');
  });

  it('reads the one narrow function and derives the tab from its counts', async () => {
    const { client, fetcher } = clientAnswering(functionAnswer());

    const insights = await getCommunityInsights({ getClient: () => client });

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.calls.mostRecent().args[0])).toContain('/rest/v1/rpc/read_community_insights');
    expect(insights.status).toBe('ready');
    expect(insights.sessionGapMinutes).toBe(30);
    expect(insights.dimensions[0].buckets[0]).toEqual({
      label: 'Monday',
      status: 'ready',
      matches: 40,
      share: 100,
      winRate: 50,
    });
  });

  it('lets no field the function happens to return reach the public answer', async () => {
    const { client } = clientAnswering(functionAnswer());

    const text = JSON.stringify(await getCommunityInsights({ getClient: () => client }));

    expect(text).not.toContain('secret-uid');
    expect(text).not.toContain('a player');
    expect(text).not.toContain('player_id');
    expect(text).not.toContain('recorders');
  });

  it('answers not enough data, and does not throw, when the function does not exist yet', async () => {
    const { client } = clientAnswering(
      { code: 'PGRST202', message: 'Could not find the function public.read_community_insights' },
      404,
    );

    const insights = await getCommunityInsights({ getClient: () => client });

    expect(insights.status).toBe('not-enough-data');
    expect(insights.sessionGapMinutes).toBeNull();
    expect(insights.dimensions.length).toBe(3);
  });

  it('answers not enough data when the answer is not the expected shape', async () => {
    const { client } = clientAnswering({ buckets: 'nope' });

    expect((await getCommunityInsights({ getClient: () => client })).status).toBe('not-enough-data');
  });

  it('answers not enough data when the project cannot be reached', async () => {
    const client = createSupabaseClient(ENV, {
      fetch: async () => {
        throw new TypeError('network down');
      },
    });

    expect((await getCommunityInsights({ getClient: () => client })).status).toBe('not-enough-data');
  });

  it('answers not enough data when Supabase is not configured here', async () => {
    const getClient = () => createSupabaseClient({});

    expect((await getCommunityInsights({ getClient })).status).toBe('not-enough-data');
  });
});

describe('parseInsightsSource', () => {
  it('rejects a bucket whose count is not a number', () => {
    const answer = functionAnswer();
    (answer['buckets'] as Record<string, unknown>[])[0]['matches'] = '40';

    expect(() => parseInsightsSource(answer)).toThrowError(/matches is not a number/);
  });

  it('rejects an answer with no session gap', () => {
    expect(() => parseInsightsSource({ buckets: [] })).toThrowError(/session_gap_minutes is not a number/);
  });
});
