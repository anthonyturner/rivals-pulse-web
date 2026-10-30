import { getCommunityInsights, parseInsightsSource } from './community-insights-read';
import { createSupabaseClient } from './supabase-client';

const ENV = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test-only' };

/** What `read_community_insights()` answers, with extra keys that no allow-list should let through. */
function functionAnswer(): Record<string, unknown> {
  const bucket = (n: number) => ({
    dimension: 'weekday',
    bucket: n,
    share_percent: 34 - n,
    win_rate_percent: 50,
    // The real answer has none of the fields below; they stand for what no allow-list should let through.
    matches: 1234,
    decided_matches: 1111,
    wins: 555,
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
      share: 33,
      winRate: 50,
    });
  });

  it('returns no exact match count anywhere: only whole-number shares and win rates', async () => {
    const { client } = clientAnswering(functionAnswer());

    const insights = await getCommunityInsights({ getClient: () => client });
    const text = JSON.stringify(insights);

    expect(Object.keys(JSON.parse(text)).filter((key) => /matches|wins|count|decided/i.test(key))).toEqual([
      'minimumMatches',
    ]);
    for (const exact of ['1234', '1111', '555']) {
      expect(text).not.toContain(exact);
    }
    for (const bucket of insights.dimensions.flatMap((d) => d.buckets)) {
      expect(Object.keys(bucket).sort()).toEqual(['label', 'share', 'status', 'winRate']);
      for (const figure of [bucket.share, bucket.winRate]) {
        expect(figure === null || (Number.isInteger(figure) && figure >= 0 && figure <= 100)).toBeTrue();
      }
    }
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
  it('rejects a bucket whose share is not a number', () => {
    const answer = functionAnswer();
    (answer['buckets'] as Record<string, unknown>[])[0]['share_percent'] = '40';

    expect(() => parseInsightsSource(answer)).toThrowError(/share_percent is not a number/);
  });

  it('rejects an answer with no session gap', () => {
    expect(() => parseInsightsSource({ buckets: [] })).toThrowError(/session_gap_minutes is not a number/);
  });
});
