import type { TripleSupportTrios } from '../../../contracts/triple-support-trios.model.ts';
import { fetchTripleSupportRows, getTripleSupportTrios, parseTripleSupportRows } from './triple-support-trios-read';

const ENV = { SUPABASE_URL: 'https://example.supabase.co/', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-only' };
const NOW = () => new Date('2026-11-07T12:00:00Z');
const MANTIS = 1020;
const LUNA = 1031;
const LOKI = 1016;
const HERO_NAMES = new Map([
  ['mantis', 'Mantis'],
  ['adam-warlock', 'Adam Warlock'],
  ['ultron', 'Ultron'],
]);

/** One row of `read_triple_support_trios()`, with extra keys that no allow-list should let through. */
function trioRow(heroes: [number, number, number], matches: number, extra: Record<string, unknown> = {}) {
  const [heroA, heroB, heroC] = [...heroes].sort((a, b) => a - b);

  return {
    half_season: 10.5,
    rank_bucket: -1,
    hero_a: heroA,
    hero_b: heroB,
    hero_c: heroC,
    matches,
    teams: matches,
    wins: Math.floor(matches / 2),
    classified_teams: 100,
    unclassified_teams: 7,
    four_plus_teams: 2,
    uid: 'secret-uid',
    name: 'a player',
    recorded_by: 'secret-recorder',
    fingerprint: 'secret-fingerprint',
    ...extra,
  };
}

const statsAnswer = {
  half_seasons: [{ half_season: 10.5, starts_at: '2026-10-09T09:00:00Z' }],
  totals: [],
  heroes: [],
};

interface Seen {
  url: string;
  init?: RequestInit;
}

/** Answers each Postgres function by name as the Supabase REST layer would, cutting row sets at `maxRows`. */
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
  read_triple_support_trios: {
    body: [trioRow([MANTIS, LUNA, LOKI], 14), trioRow([LUNA, LOKI, 1025], 11), trioRow([MANTIS, LUNA, 1999], 30)],
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
  'halfSeason',
  'inPlaceOf',
  'id',
  'label',
  'startsAt',
  'endsAt',
  'classifiedTeams',
  'unclassifiedTeams',
  'fourPlusTeams',
  'trios',
  'heroIds',
  'variant',
  'anchorHeroIds',
  'matches',
  'teams',
  'wins',
  'share',
]);

describe('getTripleSupportTrios', () => {
  const options = { env: ENV, now: NOW, loadHeroNames: async () => HERO_NAMES };

  it('returns only allow-listed keys, whatever else the database function sends', async () => {
    spyOn(console, 'warn');

    const trios = await getTripleSupportTrios({ ...options, fetch: answering(bothFunctions) });

    expect([...new Set(keysOf(trios))].filter((key) => !ALLOWED_KEYS.has(key))).toEqual([]);
    expect(JSON.stringify(trios)).not.toMatch(/secret|uid|a player|recorded|fingerprint/);
  });

  it('derives the trios with their variants and leaves out one with an untagged Strategist, with a warning', async () => {
    const warn = spyOn(console, 'warn');

    const trios: TripleSupportTrios = await getTripleSupportTrios({ ...options, fetch: answering(bothFunctions) });

    expect(trios.status).toBe('ready');
    expect(trios.halfSeason?.id).toBe(10.5);
    expect(trios.trios.map((trio) => [trio.variant.label, trio.matches])).toEqual([
      ['Mantis triple', 14],
      ['Three healers', 11],
    ]);
    expect(trios.trios[0].share).toBe(0.14);
    expect([trios.classifiedTeams, trios.unclassifiedTeams, trios.fourPlusTeams]).toEqual([100, 7, 2]);
    expect(warn).toHaveBeenCalledWith(jasmine.stringMatching(/no tag in strategist-tags\.json, or a utility hero with no name: 1999$/));
  });

  it('does not read the hero names when there is no trio to name', async () => {
    const loadHeroNames = jasmine.createSpy('loadHeroNames').and.resolveTo(HERO_NAMES);

    await getTripleSupportTrios({
      ...options,
      loadHeroNames,
      fetch: answering({ read_triple_support_trios: { body: [] }, read_hero_stats: { body: statsAnswer } }),
    });

    expect(loadHeroNames).not.toHaveBeenCalled();
  });

  it('answers the empty state when the database has no trio', async () => {
    const trios = await getTripleSupportTrios({
      ...options,
      fetch: answering({ read_triple_support_trios: { body: [] }, read_hero_stats: { body: statsAnswer } }),
    });

    expect(trios.status).toBe('not-enough-data');
    expect(trios.trios).toEqual([]);
  });

  it('fails the request when the database refuses, without echoing the key', async () => {
    await expectAsync(
      getTripleSupportTrios({ ...options, fetch: answering({ ...bothFunctions, read_triple_support_trios: { body: {}, status: 401 } }) }),
    ).toBeRejectedWithError('read_triple_support_trios answered 401');
  });

  it('is the empty state, not an error, while read_triple_support_trios is not in the database', async () => {
    const warn = spyOn(console, 'warn');

    const trios = await getTripleSupportTrios({
      ...options,
      fetch: answering({ ...bothFunctions, read_triple_support_trios: { body: { code: 'PGRST202' }, status: 404 } }),
    });

    expect(trios.status).toBe('not-enough-data');
    expect(warn).toHaveBeenCalledWith(jasmine.stringMatching(/read_triple_support_trios is not in the database/));
  });
});

describe('fetchTripleSupportRows', () => {
  it('posts the modes to the read function with the publishable key, asking only for rows with no rank', async () => {
    const seen: Seen[] = [];

    await fetchTripleSupportRows(ENV, answering({ read_triple_support_trios: { body: [] } }, seen));

    expect(seen[0].url).toBe(
      'https://example.supabase.co/rest/v1/rpc/read_triple_support_trios?limit=1000&offset=0&order=half_season,rank_bucket,hero_a,hero_b,hero_c&rank_bucket=eq.-1',
    );
    expect(seen[0].init?.method).toBe('POST');
    expect(JSON.parse(String(seen[0].init?.body))).toEqual({ p_play_mode_ids: [0, 1] });
    expect((seen[0].init?.headers as Record<string, string>)['apikey']).toBe(ENV.SUPABASE_PUBLISHABLE_KEY);
  });

  it('pages past the 1000-row cut and returns every row once, in order', async () => {
    const all = Array.from({ length: 2500 }, (_, index) => trioRow([1000 + index, 5000, 6000], 10));
    const seen: Seen[] = [];

    const rows = await fetchTripleSupportRows(ENV, answering({ read_triple_support_trios: { body: all } }, seen));

    expect(rows.map((row) => row.heroA)).toEqual(all.map((row) => row.hero_a));
    expect(seen.map((call) => new URL(call.url).searchParams.get('offset'))).toEqual(['0', '1000', '2000', '2500']);
  });

  it('throws when a row comes twice, which means the counts were rebuilt between two pages', async () => {
    const first = Array.from({ length: 1000 }, (_, index) => trioRow([1000 + index, 5000, 6000], 10));
    const rebuilt = [...first.slice(0, 999), trioRow([1999, 5000, 6000], 10), first[0]];

    await expectAsync(
      fetchTripleSupportRows(ENV, answering({ read_triple_support_trios: { body: rebuilt } })),
    ).toBeRejectedWithError(/counts changed while they were being read/);
  });

  it('names every missing variable and never a key value', async () => {
    await expectAsync(fetchTripleSupportRows({}, answering({}))).toBeRejectedWithError(
      'Triple support trios are not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.',
    );
  });

  it('rejects an answer that is not the expected shape', async () => {
    await expectAsync(fetchTripleSupportRows(ENV, answering({ read_triple_support_trios: { body: {} } }))).toBeRejected();
    await expectAsync(
      fetchTripleSupportRows(ENV, answering({ read_triple_support_trios: { body: [{ hero_a: 'x' }] } })),
    ).toBeRejected();
  });
});

describe('parseTripleSupportRows', () => {
  it('keeps the known fields and nothing else', () => {
    const [first] = parseTripleSupportRows([trioRow([MANTIS, LUNA, LOKI], 12)]);

    expect(Object.keys(first).sort()).toEqual([
      'classifiedTeams',
      'fourPlusTeams',
      'halfSeason',
      'heroA',
      'heroB',
      'heroC',
      'matches',
      'rankBucket',
      'teams',
      'unclassifiedTeams',
      'wins',
    ]);
  });
});
