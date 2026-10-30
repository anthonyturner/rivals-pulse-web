import { getCommunityInsights, parseInsightsSource } from './community-insights-read';
import { createSupabaseClient } from './supabase-client';

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test-only' };

/** What `read_community_insights()` answers, with extra keys that no allow-list should let through. */
function functionAnswer(): Record<string, unknown> {
  const bucket = (n: number) => ({
    dimension: 'weekday',
    bucket: n,
    matches: 40,
    decided_matches: 36,
    wins: 18,
    recorders: 4,
    uid: 'secret-uid',
    name: 'a player',
    player_id: 7,
  });

  return {
    session_gap_minutes: 30,
    minimum_matches: 30,
    minimum_recorders: 3,
    max_recorder_share_percent: 50,
    buckets: [bucket(1), bucket(2), bucket(3)],
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
      share: 33.3,
      winRate: 50,
    });
  });

  it('lets no field the function happens to return reach the public answer', async () => {
    const { client } = clientAnswering(functionAnswer());

    const text = JSON.stringify(await getCommunityInsights({ getClient: () => client }));

    expect(text).not.toContain('secret-uid');
    expect(text).not.toContain('a player');
    expect(text).not.toContain('player_id');
    expect(text).not.toContain('recorders"');
  });

  for (const [code, status] of [
    ['PGRST202', 404],
    ['42883', 404],
    ['42P01', 404],
  ] as const) {
    it(`answers not enough data when the function or table does not exist yet (${code})`, async () => {
      const { client } = clientAnswering({ code, message: 'does not exist' }, status);

      const insights = await getCommunityInsights({ getClient: () => client });

      expect(insights.status).toBe('not-enough-data');
      expect(insights.sessionGapMinutes).toBeNull();
      expect(insights.dimensions.length).toBe(3);
    });
  }

  for (const status of [401, 403, 500, 503]) {
    it(`keeps the error when Supabase answers ${status}, so an outage is not hidden`, async () => {
      const { client } = clientAnswering({ code: 'PGRST301', message: 'JWT expired' }, status);

      await expectAsync(getCommunityInsights({ getClient: () => client })).toBeRejectedWithError(
        /read_community_insights answered/,
      );
    });
  }

  it('keeps the error when the answer is not the expected shape', async () => {
    const { client } = clientAnswering({ buckets: 'nope' });

    await expectAsync(getCommunityInsights({ getClient: () => client })).toBeRejected();
  });

  it('keeps the error when the project cannot be reached', async () => {
    const client = createSupabaseClient(ENV, {
      fetch: async () => {
        throw new TypeError('network down');
      },
    });

    await expectAsync(getCommunityInsights({ getClient: () => client })).toBeRejected();
  });

  it('keeps the error when Supabase is not configured here', async () => {
    const getClient = () => createSupabaseClient({});

    await expectAsync(getCommunityInsights({ getClient })).toBeRejectedWithError(/not configured/);
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
