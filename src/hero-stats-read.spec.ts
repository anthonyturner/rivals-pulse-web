import type { HeroStats } from './contracts/hero-stats.model.js';
import type { RoleStats } from './contracts/role-stats.model';
import {
  fetchHeroStatsSource,
  getHeroStats,
  getRoleStats,
  halfSeasonFromQuery,
  parseHeroStatsSource,
} from './hero-stats-read';

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
  'halfSeasons',
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
  'appearances',
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

describe('getHeroStats for one half-season', () => {
  const options = { env: ENV, now: () => new Date('2026-10-30T12:00:00Z') };

  it('answers for exactly the half-season asked for', async () => {
    const stats = await getHeroStats({ ...options, halfSeason: 10.5, fetch: answering(functionAnswer()) });

    expect(stats.halfSeason?.id).toBe(10.5);
    expect(stats.matchesCounted).toBe(12);
  });
});

describe('halfSeasonFromQuery', () => {
  it('reads a half-season number, and nothing when the query has none', () => {
    expect(halfSeasonFromQuery('10.5')).toBe(10.5);
    expect(halfSeasonFromQuery(undefined)).toBeUndefined();
    expect(halfSeasonFromQuery('')).toBeUndefined();
  });

  it('turns text into a half-season no one has, so a typo never reads as the current one', () => {
    expect(halfSeasonFromQuery('latest')).toBeNaN();
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

describe('getRoleStats', () => {
  const ROLE_BY_SLUG = new Map([
    ['hulk', 'Vanguard'],
    ['captain-america', 'Vanguard'],
  ]);
  const options = {
    env: ENV,
    now: () => new Date('2026-10-30T12:00:00Z'),
    loadHeroRoles: async () => ROLE_BY_SLUG,
  };
  const ALLOWED_ROLE_KEYS = new Set([
    'status',
    'minimumLines',
    'halfSeasons',
    'halfSeason',
    'inPlaceOf',
    'modes',
    'id',
    'label',
    'startsAt',
    'endsAt',
    'roles',
    'role',
    'appearances',
    'winRate',
    'killsAverage',
    'deathsAverage',
    'assistsAverage',
    'kda',
    'finalHitsAverage',
  ]);

  beforeEach(() => spyOn(console, 'warn'));

  it('returns only allow-listed keys, whatever else the database function sends', async () => {
    const stats = await getRoleStats({ ...options, fetch: answering(functionAnswer()) });

    expect([...new Set(keysOf(stats))].filter((key) => !ALLOWED_ROLE_KEYS.has(key))).toEqual([]);
    expect(JSON.stringify(stats)).not.toMatch(/secret|uid|fingerprint|a player|hulk|captain/);
  });

  it('pools the heroes of a role from the aggregates and leaves out the unmapped hero id 0 with a warning', async () => {
    const warn = console.warn as jasmine.Spy;

    const stats: RoleStats = await getRoleStats({ ...options, fetch: answering(functionAnswer()) });
    const vanguard = stats.modes[0].roles[0];

    expect(vanguard.role).toBe('Vanguard');
    expect(vanguard.appearances).toBe(24);
    expect(vanguard.status).toBe('not-enough-data');
    expect(warn).toHaveBeenCalledWith(jasmine.stringMatching(/ids with no role: 0$/));
  });

  it('answers for exactly the half-season asked for', async () => {
    const stats = await getRoleStats({ ...options, halfSeason: 10.5, fetch: answering(functionAnswer()) });

    expect(stats.halfSeason?.id).toBe(10.5);
  });

  it('does not read the hero roles when there are no counts to split', async () => {
    const loadHeroRoles = jasmine.createSpy('loadHeroRoles').and.resolveTo(ROLE_BY_SLUG);

    const stats = await getRoleStats({
      ...options,
      loadHeroRoles,
      fetch: answering({ half_seasons: [], totals: [], heroes: [] }),
    });

    expect(stats.status).toBe('not-enough-data');
    expect(loadHeroRoles).not.toHaveBeenCalled();
  });

  it('is the empty state, not an error, while the aggregates are not in the database yet', async () => {
    const warn = console.warn as jasmine.Spy;

    const stats = await getRoleStats({ ...options, fetch: answering({ code: 'PGRST202' }, 404) });

    expect(stats.status).toBe('not-enough-data');
    expect(stats.halfSeason).toBeNull();
    expect(stats.modes.length).toBe(3);
    expect(warn).toHaveBeenCalledWith(jasmine.stringMatching(/read_hero_stats is not in the database/));
  });

  it('still fails on a refused call or a missing configuration', async () => {
    await expectAsync(getRoleStats({ ...options, fetch: answering({}, 401) })).toBeRejectedWithError('read_hero_stats answered 401');
    await expectAsync(getRoleStats({ ...options, env: {}, fetch: answering({}) })).toBeRejected();
  });
});
