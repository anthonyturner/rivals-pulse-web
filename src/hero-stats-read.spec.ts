import type { HeroStats } from './contracts/hero-stats.model.js';
import { fetchHeroStatsSource, getHeroStats, parseHeroStatsSource } from './hero-stats-read';

const ENV = { SUPABASE_URL: 'https://example.supabase.co/', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-only' };

/** What `read_hero_stats()` answers, with extra keys that no allow-list should let through. */
function functionAnswer(): Record<string, unknown> {
  const line = (heroId: number, lines: number, wins: number) => ({
    half_season: 10.5,
    play_mode_id: 1,
    hero_id: heroId,
    decided_lines: lines,
    wins,
    kills_sum: 100,
    kills_n: lines,
    deaths_sum: 50,
    deaths_n: lines,
    assists_sum: 50,
    assists_n: lines,
    final_hits_sum: 0,
    final_hits_n: 0,
    uid: 'secret-uid',
    name: 'a player',
    fingerprint: 'abc',
  });

  return {
    half_seasons: [{ half_season: 10.5, starts_at: '2026-10-09T09:00:00Z', secret: 'x' }],
    totals: [{ half_season: 10.5, play_mode_id: 1, decided_matches: 12, matches: 99 }],
    heroes: [line(1011, 12, 9), line(1022, 12, 3), line(0, 5, 2)],
  };
}

function answering(body: unknown, status = 200): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status });
}

function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(keysOf);
  }

  return typeof value === 'object' && value !== null
    ? Object.entries(value).flatMap(([key, inner]) => [key, ...keysOf(inner)])
    : [];
}

const ALLOWED_KEYS = new Set([
  'status',
  'minimumMatches',
  'halfSeason',
  'inPlaceOf',
  'matchesCounted',
  'tiers',
  'belowMinimum',
  'id',
  'label',
  'startsAt',
  'endsAt',
  'name',
  'heroes',
  'hero',
  'matches',
  'wins',
  'winRate',
  'pickRate',
  'shrunkWinRate',
  'tier',
  'kda',
  'finalHitsAverage',
]);

describe('getHeroStats', () => {
  const options = { env: ENV, now: () => new Date('2026-10-30T12:00:00Z') };

  it('returns only allow-listed keys, whatever else the database function sends', async () => {
    const stats = await getHeroStats({ ...options, fetch: answering(functionAnswer()) });

    expect([...new Set(keysOf(stats))].filter((key) => !ALLOWED_KEYS.has(key))).toEqual([]);
    expect(JSON.stringify(stats)).not.toMatch(/secret|uid|fingerprint|a player/);
  });

  it('derives the numbers and leaves out the unmapped hero id 0 with a warning, never an error', async () => {
    const warn = spyOn(console, 'warn');

    const stats: HeroStats = await getHeroStats({ ...options, fetch: answering(functionAnswer()) });

    expect(stats.status).toBe('ready');
    expect(stats.tiers.flatMap((tier) => tier.heroes).map((hero) => hero.hero)).toEqual(['hulk', 'captain-america']);
    expect(warn).toHaveBeenCalledWith(jasmine.stringMatching(/ids with no hero mapping: 0$/));
  });
});

describe('fetchHeroStatsSource', () => {
  it('posts to the read function with the publishable key', async () => {
    let seen: { url: string; init?: RequestInit } | undefined;
    const fetcher: typeof fetch = async (input, init) => {
      seen = { url: String(input), init };

      return new Response(JSON.stringify({ half_seasons: [], totals: [], heroes: [] }));
    };

    await fetchHeroStatsSource(ENV, fetcher);

    expect(seen?.url).toBe('https://example.supabase.co/rest/v1/rpc/read_hero_stats');
    expect(seen?.init?.method).toBe('POST');
    expect((seen?.init?.headers as Record<string, string>)['apikey']).toBe(ENV.SUPABASE_PUBLISHABLE_KEY);
  });

  it('names every missing variable and never a key value', async () => {
    await expectAsync(fetchHeroStatsSource({}, answering({}))).toBeRejectedWithError(
      'Hero stats are not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.',
    );
    await expectAsync(fetchHeroStatsSource({ SUPABASE_URL: ENV.SUPABASE_URL }, answering({}))).toBeRejectedWithError(
      'Hero stats are not configured. Set SUPABASE_PUBLISHABLE_KEY.',
    );
  });

  it('fails on a refused call without echoing the key', async () => {
    await expectAsync(fetchHeroStatsSource(ENV, answering({ message: 'denied' }, 401))).toBeRejectedWithError(
      'read_hero_stats answered 401',
    );
  });

  it('rejects an answer that is not the expected shape', async () => {
    await expectAsync(fetchHeroStatsSource(ENV, answering([]))).toBeRejected();
    await expectAsync(
      fetchHeroStatsSource(ENV, answering({ half_seasons: [], totals: [], heroes: [{ hero_id: 'x' }] })),
    ).toBeRejected();
  });
});

describe('parseHeroStatsSource', () => {
  it('keeps the known fields and nothing else', () => {
    const source = parseHeroStatsSource(functionAnswer());

    expect(Object.keys(source.heroes[0]).sort()).toEqual([
      'assistsN',
      'assistsSum',
      'deathsN',
      'deathsSum',
      'decidedLines',
      'finalHitsN',
      'finalHitsSum',
      'gameHeroId',
      'halfSeason',
      'killsN',
      'killsSum',
      'playModeId',
      'wins',
    ]);
    expect(Object.keys(source.totals[0]).sort()).toEqual(['decidedMatches', 'halfSeason', 'playModeId']);
    expect(Object.keys(source.halfSeasons[0]).sort()).toEqual(['halfSeason', 'startsAt']);
  });
});
