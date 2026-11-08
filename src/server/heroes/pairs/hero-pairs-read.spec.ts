import type { HeroPairs } from '../../../contracts/hero-pairs.model.ts';
import { fetchHeroPairRows, getHeroPairs, parseHeroPairRows } from './hero-pairs-read';

const ENV = { SUPABASE_URL: 'https://example.supabase.co/', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-only' };
const NOW = () => new Date('2026-10-30T12:00:00Z');

/** One row of `read_hero_pairs()`, with extra keys that no allow-list should let through. */
function pairRow(kind: string, heroId: number, otherId: number, matches: number, extra: Record<string, unknown> = {}) {
  return {
    half_season: 10.5,
    rank_bucket: -1,
    kind,
    hero_id: heroId,
    other_hero_id: otherId,
    decided_matches: matches,
    decided_lines: matches,
    wins: Math.floor(matches / 2),
    uid: 'secret-uid',
    name: 'a player',
    ...extra,
  };
}

const statsAnswer = {
  half_seasons: [{ half_season: 10.5, starts_at: '2026-10-09T09:00:00Z' }],
  totals: [{ half_season: 10.5, play_mode_id: 1, decided_matches: 80 }],
  heroes: [
    {
      half_season: 10.5,
      play_mode_id: 1,
      hero_id: 1011,
      decided_lines: 40,
      wins: 22,
      kills_sum: 0,
      kills_n: 0,
      deaths_sum: 0,
      deaths_n: 0,
      assists_sum: 0,
      assists_n: 0,
      final_hits_sum: 0,
      final_hits_n: 0,
    },
  ],
};

interface Seen {
  url: string;
  init?: RequestInit;
}

/**
 * Answers each Postgres function by name as the Supabase REST layer would. `read_hero_pairs` is
 * served in pages of at most `maxRows` rows from `offset`, exactly as PostgREST cuts a set.
 */
function answering(
  functions: Record<string, { body: unknown; status?: number }>,
  seen: Seen[] = [],
  maxRows = 1000,
): typeof fetch {
  return async (input, init) => {
    const url = new URL(String(input));
    seen.push({ url: String(input), init });
    const answer = functions[url.pathname.split('/rpc/')[1]];
    const body = answer?.body ?? {};

    if (!Array.isArray(body)) {
      return new Response(JSON.stringify(body), { status: answer?.status ?? 200 });
    }

    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? maxRows), maxRows);

    return new Response(JSON.stringify(body.slice(offset, offset + limit)), { status: answer?.status ?? 200 });
  };
}

const bothFunctions = {
  read_hero_pairs: {
    body: [pairRow('vs', 1011, 1022, 12), pairRow('vs', 1022, 1011, 12), pairRow('with', 1011, 1033, 14), pairRow('vs', 0, 1011, 14)],
  },
  read_hero_stats: { body: statsAnswer },
};

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
  'priorMatches',
  'halfSeason',
  'inPlaceOf',
  'halfSeasons',
  'mode',
  'modes',
  'bands',
  'id',
  'label',
  'startsAt',
  'endsAt',
  'key',
  'decidedMatches',
  'heroes',
  'heroId',
  'appearances',
  'wins',
  'counters',
  'enemyHeroId',
  'matches',
  'synergies',
  'allyHeroId',
]);

describe('getHeroPairs', () => {
  const options = { env: ENV, now: NOW };

  it('returns only allow-listed keys, whatever else the database function sends', async () => {
    const pairs = await getHeroPairs({ ...options, fetch: answering(bothFunctions) });

    expect([...new Set(keysOf(pairs))].filter((key) => !ALLOWED_KEYS.has(key))).toEqual([]);
    expect(JSON.stringify(pairs)).not.toMatch(/secret|uid|a player/);
  });

  it('derives the pairs and leaves out the unmapped hero id 0 with a warning, never an error', async () => {
    const warn = spyOn(console, 'warn');

    const pairs: HeroPairs = await getHeroPairs({ ...options, fetch: answering(bothFunctions) });

    expect(pairs.status).toBe('ready');
    expect(pairs.halfSeason?.id).toBe(10.5);
    expect(pairs.bands[0].decidedMatches).toBe(80);
    expect(pairs.bands[0].heroes).toEqual([{ heroId: 1011, appearances: 40, wins: 22 }]);
    expect(pairs.bands[0].counters.map((counter) => `${counter.heroId}>${counter.enemyHeroId}`)).toEqual(['1011>1022', '1022>1011']);
    expect(pairs.bands[0].synergies.map((synergy) => `${synergy.heroId}+${synergy.allyHeroId}`)).toEqual(['1011+1033']);
    expect(warn).toHaveBeenCalledWith(jasmine.stringMatching(/ids with no hero mapping: 0$/));
  });

  it('lists the half-seasons and modes a client can ask for, counted in the half-season shown', async () => {
    const pairs = await getHeroPairs({ ...options, fetch: answering(bothFunctions) });

    expect(pairs.mode).toBe('all');
    expect(pairs.halfSeasons?.map(({ id }) => id)).toEqual([10.5]);
    expect(pairs.modes?.map(({ id, decidedMatches }) => [id, decidedMatches])).toEqual([
      ['all', 80],
      ['quick-match', 0],
      ['competitive', 80],
      ['arcade', 0],
      ['practice', 0],
    ]);
  });

  it('reads one mode on its own: asks the function for that mode and counts only its matches', async () => {
    const seen: Seen[] = [];

    const pairs = await getHeroPairs({ ...options, mode: 'competitive', fetch: answering(bothFunctions, seen) });
    const call = seen.find(({ url }) => url.includes('read_hero_pairs'));

    expect(JSON.parse(String(call?.init?.body))).toEqual({ p_play_mode_ids: [1] });
    expect(pairs.mode).toBe('competitive');
    expect(pairs.bands[0].decidedMatches).toBe(80);
    expect(pairs.bands[0].heroes).toEqual([{ heroId: 1011, appearances: 40, wins: 22 }]);
  });

  it('counts nothing for a mode with no matches, without borrowing the blend', async () => {
    const pairs = await getHeroPairs({ ...options, mode: 'quick-match', fetch: answering(bothFunctions) });

    expect(pairs.mode).toBe('quick-match');
    expect(pairs.bands[0].decidedMatches).toBe(0);
    expect(pairs.bands[0].heroes).toEqual([]);
  });

  it('answers the empty state for a mode that names no mode, without reading the pairs', async () => {
    const seen: Seen[] = [];

    const pairs = await getHeroPairs({ ...options, mode: 'ranked', fetch: answering(bothFunctions, seen) });

    expect(pairs.status).toBe('not-enough-data');
    expect(pairs.mode).toBeNull();
    expect(pairs.bands[0].synergies).toEqual([]);
    expect(seen.some(({ url }) => url.includes('read_hero_pairs'))).toBeFalse();
  });

  it('shows exactly the half-season asked for, with no fall-back, and none for one that has not started', async () => {
    const twoSeasons = {
      ...statsAnswer,
      half_seasons: [
        { half_season: 10, starts_at: '2026-09-01T00:00:00Z' },
        { half_season: 10.5, starts_at: '2026-10-09T09:00:00Z' },
        { half_season: 11, starts_at: '2026-12-01T00:00:00Z' },
      ],
    };
    const fetch = answering({
      read_hero_pairs: { body: [pairRow('with', 1011, 1033, 14, { half_season: 10 })] },
      read_hero_stats: { body: twoSeasons },
    });

    const earlier = await getHeroPairs({ ...options, halfSeason: 10, fetch });
    const current = await getHeroPairs({ ...options, halfSeason: 10.5, fetch });
    const future = await getHeroPairs({ ...options, halfSeason: 11, fetch });
    const unknown = await getHeroPairs({ ...options, halfSeason: Number.NaN, fetch });

    expect(earlier.halfSeason?.id).toBe(10);
    expect(earlier.bands[0].synergies.length).toBe(1);
    expect(current.halfSeason?.id).toBe(10.5);
    expect(current.inPlaceOf).toBeNull();
    expect(current.status).toBe('not-enough-data');
    expect(future.halfSeason).toBeNull();
    expect(unknown.halfSeason).toBeNull();
    expect(earlier.halfSeasons?.map(({ id }) => id)).toEqual([10, 10.5]);
  });

  it('answers the empty state when the database has no pair', async () => {
    const pairs = await getHeroPairs({
      ...options,
      fetch: answering({ read_hero_pairs: { body: [] }, read_hero_stats: { body: statsAnswer } }),
    });

    expect(pairs.status).toBe('not-enough-data');
    expect(pairs.bands[0].counters).toEqual([]);
  });

  it('fails the request when the database refuses, without echoing the key', async () => {
    await expectAsync(
      getHeroPairs({ ...options, fetch: answering({ ...bothFunctions, read_hero_pairs: { body: {}, status: 401 } }) }),
    ).toBeRejectedWithError('read_hero_pairs answered 401');
  });
});

describe('getHeroPairs while a read function is not in the database', () => {
  const options = { env: ENV, now: NOW };

  beforeEach(() => spyOn(console, 'warn'));

  it('is the empty state, not an error, when read_hero_pairs is missing', async () => {
    const pairs = await getHeroPairs({
      ...options,
      fetch: answering({ ...bothFunctions, read_hero_pairs: { body: { code: 'PGRST202' }, status: 404 } }),
    });

    expect(pairs.status).toBe('not-enough-data');
    expect(pairs.bands[0].counters).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(jasmine.stringMatching(/read_hero_pairs is not in the database/));
  });

  it('still fails on a refused call', async () => {
    await expectAsync(
      getHeroPairs({ ...options, fetch: answering({ ...bothFunctions, read_hero_stats: { body: { code: '42501' }, status: 401 } }) }),
    ).toBeRejectedWithError('read_hero_stats answered 401');
  });
});

describe('fetchHeroPairRows', () => {
  it('posts the modes to the read function with the publishable key', async () => {
    const seen: Seen[] = [];

    await fetchHeroPairRows(ENV, answering({ read_hero_pairs: { body: [] } }, seen));

    expect(seen[0].url).toBe(
      'https://example.supabase.co/rest/v1/rpc/read_hero_pairs?limit=1000&offset=0&order=half_season,rank_bucket,kind,hero_id,other_hero_id&rank_bucket=eq.-1',
    );
    expect(seen[0].init?.method).toBe('POST');
    expect(JSON.parse(String(seen[0].init?.body))).toEqual({ p_play_mode_ids: [0, 1] });
    expect((seen[0].init?.headers as Record<string, string>)['apikey']).toBe(ENV.SUPABASE_PUBLISHABLE_KEY);
  });

  it('pages past the 1000-row cut and returns every row once, in order', async () => {
    const all = Array.from({ length: 2500 }, (_, index) => pairRow('vs', 1000 + index, 5000, 10));
    const seen: Seen[] = [];

    const rows = await fetchHeroPairRows(ENV, answering({ read_hero_pairs: { body: all } }, seen));

    expect(rows.length).toBe(2500);
    expect(rows.map((row) => row.gameHeroId)).toEqual(all.map((row) => row.hero_id));
    expect(seen.map((call) => new URL(call.url).searchParams.get('offset'))).toEqual(['0', '1000', '2000', '2500']);
    expect(seen.every((call) => new URL(call.url).searchParams.get('order') === 'half_season,rank_bucket,kind,hero_id,other_hero_id')).toBeTrue();
  });

  it('asks only for rows with no rank, whatever page it reads', async () => {
    const all = Array.from({ length: 1200 }, (_, index) => pairRow('with', 1000 + index, 5000, 10));
    const seen: Seen[] = [];

    await fetchHeroPairRows(ENV, answering({ read_hero_pairs: { body: all } }, seen));

    expect(seen.length).toBe(3);
    expect(seen.every((call) => new URL(call.url).searchParams.get('rank_bucket') === 'eq.-1')).toBeTrue();
  });

  it('throws when a row comes twice, which means the counts were rebuilt between two pages', async () => {
    const first = Array.from({ length: 1000 }, (_, index) => pairRow('with', 1000 + index, 5000, 10));
    const rebuilt = [...first.slice(0, 999), pairRow('with', 1999, 5000, 10), first[0]];

    await expectAsync(fetchHeroPairRows(ENV, answering({ read_hero_pairs: { body: rebuilt } }))).toBeRejectedWithError(
      /counts changed while they were being read/,
    );
  });

  it('keeps reading when the server cuts pages shorter than asked for', async () => {
    const all = Array.from({ length: 700 }, (_, index) => pairRow('with', 1000 + index, 5000, 10));

    const rows = await fetchHeroPairRows(ENV, answering({ read_hero_pairs: { body: all } }, [], 300));

    expect(rows.length).toBe(700);
  });

  it('gives up on a server that never runs out of new rows', async () => {
    let calls = 0;
    const stuck: typeof fetch = async () => {
      calls += 1;

      return new Response(JSON.stringify([pairRow('vs', 1000 + calls, 1022, 10)]), { status: 200 });
    };

    await expectAsync(fetchHeroPairRows(ENV, stuck)).toBeRejectedWithError(/more than 200 pages/);
  });

  it('reports a server that keeps answering the same page as rows that changed under it', async () => {
    const same: typeof fetch = async () => new Response(JSON.stringify([pairRow('vs', 1011, 1022, 10)]), { status: 200 });

    await expectAsync(fetchHeroPairRows(ENV, same)).toBeRejectedWithError(/counts changed while they were being read/);
  });

  it('names every missing variable and never a key value', async () => {
    await expectAsync(fetchHeroPairRows({}, answering({}))).toBeRejectedWithError(
      'Hero pairs are not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.',
    );
  });

  it('rejects an answer that is not the expected shape', async () => {
    await expectAsync(fetchHeroPairRows(ENV, answering({ read_hero_pairs: { body: {} } }))).toBeRejected();
    await expectAsync(fetchHeroPairRows(ENV, answering({ read_hero_pairs: { body: [{ hero_id: 'x' }] } }))).toBeRejected();
  });
});

describe('parseHeroPairRows', () => {
  it('keeps the known fields and nothing else', () => {
    const [first] = parseHeroPairRows([pairRow('with', 1011, 1022, 12)]);

    expect(Object.keys(first).sort()).toEqual([
      'decidedLines',
      'decidedMatches',
      'gameHeroId',
      'halfSeason',
      'kind',
      'otherGameHeroId',
      'rankBucket',
      'wins',
    ]);
  });

  it('rejects a kind it does not know instead of counting it as one of the two', () => {
    expect(() => parseHeroPairRows([pairRow('beside', 1011, 1022, 12)])).toThrowError(/kind is neither vs nor with/);
  });
});
