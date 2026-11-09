import type { HeroMatchups } from '../../../contracts/hero-matchups.model.ts';
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
  'kda',
  'finalHitsAverage',
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
      'figures',
      'gameHeroId',
      'halfSeason',
      'wins',
    ]);
  });

  const FIGURES = {
    kills_sum: 60,
    kills_n: 12,
    deaths_sum: 24,
    deaths_n: 12,
    assists_sum: 36,
    assists_n: 12,
    final_hits_sum: 48,
    final_hits_n: 12,
  };

  it('reads the figures of a row that has them', () => {
    const [first] = parseHeroMatchupRows([{ ...matchupAnswer()[0], ...FIGURES }]);

    expect(first.figures).toEqual({
      killsSum: 60,
      killsN: 12,
      deathsSum: 24,
      deathsN: 12,
      assistsSum: 36,
      assistsN: 12,
      finalHitsSum: 48,
      finalHitsN: 12,
    });
  });

  it('reads the old row shape, with the figures absent, as no figures rather than failing', () => {
    const rows = parseHeroMatchupRows(matchupAnswer());

    expect(rows.length).toBe(3);
    expect(rows.every((row) => row.figures === null)).toBeTrue();
  });

  it('reads figures the database returned as null, as a frozen half-season does, as no figures', () => {
    const frozen = Object.fromEntries(Object.keys(FIGURES).map((key) => [key, null]));
    const [first] = parseHeroMatchupRows([{ ...matchupAnswer()[0], ...frozen }]);

    expect(first.figures).toBeNull();
  });

  it('reads a row with only some figures as no figures, never as zeros', () => {
    const [first] = parseHeroMatchupRows([{ ...matchupAnswer()[0], ...FIGURES, deaths_sum: null, deaths_n: null }]);

    expect(first.figures).toBeNull();
  });

  it('rejects a figure that is neither a number nor null', () => {
    expect(() => parseHeroMatchupRows([{ ...matchupAnswer()[0], ...FIGURES, kills_sum: 'many' }])).toThrowError(
      /kills_sum is not a number or null/,
    );
  });
});

describe('getHeroMatchups with the encounter figures', () => {
  const options = { env: ENV, now: NOW };

  const withFigures = (line: Record<string, unknown>, kills: number, finalHits: number) => ({
    ...line,
    kills_sum: kills * 12,
    kills_n: 12,
    deaths_sum: 24,
    deaths_n: 12,
    assists_sum: 36,
    assists_n: 12,
    final_hits_sum: finalHits * 12,
    final_hits_n: 12,
  });

  beforeEach(() => spyOn(console, 'warn'));

  it('derives KDA and final hits per match for each direction of a pair', async () => {
    const [hulk, captain] = matchupAnswer();
    const body = [withFigures(hulk, 5, 4), withFigures(captain, 1, 2)];
    const { matchups } = await getHeroMatchups({
      ...options,
      fetch: answering({ ...bothFunctions, read_hero_matchups: { body } }),
    });

    expect(matchups.map((matchup) => [matchup.hero, matchup.kda, matchup.finalHitsAverage])).toEqual([
      ['captain-america', (12 + 36) / 24, 2],
      ['hulk', (60 + 36) / 24, 4],
    ]);
  });

  it('returns null figures, and no NaN, for an answer that predates the figures', async () => {
    const { matchups } = await getHeroMatchups({ ...options, fetch: answering(bothFunctions) });

    expect(matchups.length).toBe(2);
    expect(matchups.every((matchup) => matchup.kda === null && matchup.finalHitsAverage === null)).toBeTrue();
    expect(JSON.stringify(matchups)).not.toContain('NaN');
  });
});
