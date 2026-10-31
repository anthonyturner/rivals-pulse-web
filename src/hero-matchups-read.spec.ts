import type { HeroMatchups } from './contracts/hero-matchups.model.js';
import { fetchHeroMatchupRows, getHeroMatchups, parseHeroMatchupRows } from './hero-matchups-read';

const ENV = { SUPABASE_URL: 'https://example.supabase.co/', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-only' };
const NOW = () => new Date('2026-10-30T12:00:00Z');

/** What `read_hero_matchups()` answers, with extra keys that no allow-list should let through. */
function matchupAnswer(): Record<string, unknown>[] {
  const line = (heroId: number, enemyId: number, matches: number, wins: number) => ({
    half_season: 10.5,
    hero_id: heroId,
    enemy_hero_id: enemyId,
    decided_matches: matches,
    decided_lines: matches,
    wins,
    uid: 'secret-uid',
    name: 'a player',
    fingerprint: 'abc',
  });

  return [line(1011, 1022, 12, 9), line(1022, 1011, 12, 3), line(0, 1011, 14, 7)];
}

const statsAnswer = {
  half_seasons: [{ half_season: 10.5, starts_at: '2026-10-09T09:00:00Z' }],
  totals: [],
  heroes: [],
};

/** Answers each Postgres function by name, as the Supabase REST layer would. */
function answering(functions: Record<string, { body: unknown; status?: number }>, seen: { url: string; init?: RequestInit }[] = []): typeof fetch {
  return async (input, init) => {
    const url = String(input);
    seen.push({ url, init });
    const answer = functions[url.split('/rpc/')[1]];

    return new Response(JSON.stringify(answer?.body ?? {}), { status: answer?.status ?? 200 });
  };
}

const bothFunctions = {
  read_hero_matchups: { body: matchupAnswer() },
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
  'matchups',
  'id',
  'label',
  'startsAt',
  'endsAt',
  'hero',
  'enemy',
  'matches',
  'appearances',
  'wins',
  'winRate',
  'shrunkWinRate',
]);

describe('getHeroMatchups', () => {
  const options = { env: ENV, now: NOW };

  it('returns only allow-listed keys, whatever else the database function sends', async () => {
    const matchups = await getHeroMatchups({ ...options, fetch: answering(bothFunctions) });

    expect([...new Set(keysOf(matchups))].filter((key) => !ALLOWED_KEYS.has(key))).toEqual([]);
    expect(JSON.stringify(matchups)).not.toMatch(/secret|uid|fingerprint|a player/);
  });

  it('publishes nothing that orders heroes to ban or scores them for banning', async () => {
    const matchups = await getHeroMatchups({ ...options, fetch: answering(bothFunctions) });

    expect(JSON.stringify(matchups)).not.toMatch(/ban|rank|score|tier/i);
  });

  it('derives the matchups and leaves out the unmapped hero id 0 with a warning, never an error', async () => {
    const warn = spyOn(console, 'warn');

    const matchups: HeroMatchups = await getHeroMatchups({ ...options, fetch: answering(bothFunctions) });

    expect(matchups.status).toBe('ready');
    expect(matchups.halfSeason?.id).toBe(10.5);
    expect(matchups.matchups.map((matchup) => `${matchup.hero}>${matchup.enemy}`)).toEqual(['captain-america>hulk', 'hulk>captain-america']);
    expect(warn).toHaveBeenCalledWith(jasmine.stringMatching(/ids with no hero mapping: 0$/));
  });

  it('answers the empty state when the database has no matchup', async () => {
    const matchups = await getHeroMatchups({
      ...options,
      fetch: answering({ read_hero_matchups: { body: [] }, read_hero_stats: { body: statsAnswer } }),
    });

    expect(matchups.status).toBe('not-enough-data');
    expect(matchups.matchups).toEqual([]);
  });

  it('fails the request when the database refuses, without echoing the key', async () => {
    await expectAsync(
      getHeroMatchups({ ...options, fetch: answering({ ...bothFunctions, read_hero_matchups: { body: {}, status: 401 } }) }),
    ).toBeRejectedWithError('read_hero_matchups answered 401');
  });
});

describe('getHeroMatchups while a read function is not in the database', () => {
  const options = { env: ENV, now: NOW };

  beforeEach(() => spyOn(console, 'warn'));

  it('is the empty state, not an error, when read_hero_matchups is missing', async () => {
    const matchups = await getHeroMatchups({
      ...options,
      fetch: answering({ ...bothFunctions, read_hero_matchups: { body: { code: 'PGRST202' }, status: 404 } }),
    });

    expect(matchups.status).toBe('not-enough-data');
    expect(matchups.matchups).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(jasmine.stringMatching(/read_hero_matchups is not in the database/));
  });

  it('still fails on a refused call', async () => {
    await expectAsync(
      getHeroMatchups({ ...options, fetch: answering({ ...bothFunctions, read_hero_stats: { body: { code: '42501' }, status: 401 } }) }),
    ).toBeRejectedWithError('read_hero_stats answered 401');
  });
});

describe('fetchHeroMatchupRows', () => {
  it('posts the modes to the read function with the publishable key', async () => {
    const seen: { url: string; init?: RequestInit }[] = [];

    await fetchHeroMatchupRows(ENV, answering({ read_hero_matchups: { body: [] } }, seen));

    expect(seen[0].url).toBe('https://example.supabase.co/rest/v1/rpc/read_hero_matchups');
    expect(seen[0].init?.method).toBe('POST');
    expect(JSON.parse(String(seen[0].init?.body))).toEqual({ p_play_mode_ids: [0, 1] });
    expect((seen[0].init?.headers as Record<string, string>)['apikey']).toBe(ENV.SUPABASE_PUBLISHABLE_KEY);
  });

  it('names every missing variable and never a key value', async () => {
    await expectAsync(fetchHeroMatchupRows({}, answering({}))).toBeRejectedWithError(
      'Hero matchups are not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.',
    );
  });

  it('rejects an answer that is not the expected shape', async () => {
    await expectAsync(fetchHeroMatchupRows(ENV, answering({ read_hero_matchups: { body: {} } }))).toBeRejected();
    await expectAsync(
      fetchHeroMatchupRows(ENV, answering({ read_hero_matchups: { body: [{ hero_id: 'x' }] } })),
    ).toBeRejected();
  });
});

describe('parseHeroMatchupRows', () => {
  it('keeps the known fields and nothing else', () => {
    const [first] = parseHeroMatchupRows(matchupAnswer());

    expect(Object.keys(first).sort()).toEqual([
      'decidedLines',
      'decidedMatches',
      'enemyGameHeroId',
      'gameHeroId',
      'halfSeason',
      'wins',
    ]);
  });
});
