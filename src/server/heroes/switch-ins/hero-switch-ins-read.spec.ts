import type { HeroSwitchIns } from '../../../contracts/hero-switch-ins.model.ts';
import { fetchHeroSwitchInRows, getHeroSwitchIns, parseHeroSwitchInRows } from './hero-switch-ins-read';

const ENV = { SUPABASE_URL: 'https://example.supabase.co/', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-only' };
const NOW = () => new Date('2026-10-30T12:00:00Z');

/** What `read_hero_switch_ins()` answers, with extra keys that no allow-list should let through. */
function switchInAnswer(): { switch_ins: Record<string, unknown>[] } {
  const line = (heroId: number, enemyId: number, matches: number, switches: number, wins: number) => ({
    half_season: 10.5,
    hero_id: heroId,
    enemy_hero_id: enemyId,
    matches,
    switches,
    wins,
    uid: 'secret-uid',
    name: 'a player',
    fingerprint: 'abc',
    recorders: 3,
  });

  return { switch_ins: [line(1011, 1022, 12, 14, 6), line(1022, 1011, 12, 12, 3), line(0, 1011, 14, 14, 7)] };
}

const matchupAnswer = [
  { half_season: 10.5, hero_id: 1011, enemy_hero_id: 1022, decided_matches: 30, decided_lines: 30, wins: 18 },
];

const statsAnswer = {
  half_seasons: [{ half_season: 10.5, starts_at: '2026-10-09T09:00:00Z' }],
  totals: [],
  heroes: [],
};

/** Answers each Postgres function by name, as the Supabase REST layer would. */
function answering(
  functions: Record<string, { body: unknown; status?: number }>,
  seen: { url: string; init?: RequestInit }[] = [],
): typeof fetch {
  return async (input, init) => {
    const url = String(input);
    seen.push({ url, init });
    const answer = functions[url.split('/rpc/')[1]];

    return new Response(JSON.stringify(answer?.body ?? {}), { status: answer?.status ?? 200 });
  };
}

const allFunctions = {
  read_hero_switch_ins: { body: switchInAnswer() },
  read_hero_matchups: { body: matchupAnswer },
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
  'minimumPlayers',
  'halfSeason',
  'inPlaceOf',
  'switchIns',
  'id',
  'label',
  'startsAt',
  'endsAt',
  'hero',
  'enemy',
  'matches',
  'switches',
  'wins',
  'winRate',
  'overall',
  'appearances',
]);

describe('getHeroSwitchIns', () => {
  const options = { env: ENV, now: NOW };

  it('returns only allow-listed keys, whatever else the database function sends', async () => {
    const switchIns = await getHeroSwitchIns({ ...options, fetch: answering(allFunctions) });

    expect([...new Set(keysOf(switchIns))].filter((key) => !ALLOWED_KEYS.has(key))).toEqual([]);
    expect(JSON.stringify(switchIns)).not.toMatch(/secret|uid|fingerprint|a player|recorders/);
  });

  it('derives the switch-ins beside the overall record and leaves out hero id 0 with a warning, never an error', async () => {
    const warn = spyOn(console, 'warn');

    const switchIns: HeroSwitchIns = await getHeroSwitchIns({ ...options, fetch: answering(allFunctions) });

    expect(switchIns.status).toBe('ready');
    expect(switchIns.halfSeason?.id).toBe(10.5);
    expect(switchIns.switchIns.map((line) => `${line.hero}>${line.enemy}:${line.overall?.matches ?? 'none'}`)).toEqual([
      'captain-america>hulk:none',
      'hulk>captain-america:30',
    ]);
    expect(warn).toHaveBeenCalledWith(jasmine.stringMatching(/ids with no hero mapping: 0$/));
  });

  it('answers the empty state when the database has no switch-in', async () => {
    const switchIns = await getHeroSwitchIns({
      ...options,
      fetch: answering({ ...allFunctions, read_hero_switch_ins: { body: { switch_ins: [] } } }),
    });

    expect(switchIns.status).toBe('not-enough-data');
    expect(switchIns.switchIns).toEqual([]);
  });

  it('fails the request when the database refuses, without echoing the key', async () => {
    await expectAsync(
      getHeroSwitchIns({ ...options, fetch: answering({ ...allFunctions, read_hero_switch_ins: { body: {}, status: 401 } }) }),
    ).toBeRejectedWithError('read_hero_switch_ins answered 401');
  });
});

describe('getHeroSwitchIns while a read function is not in the database', () => {
  const options = { env: ENV, now: NOW };

  beforeEach(() => spyOn(console, 'warn'));

  it('is the empty state, not an error, when read_hero_switch_ins is missing', async () => {
    const switchIns = await getHeroSwitchIns({
      ...options,
      fetch: answering({ ...allFunctions, read_hero_switch_ins: { body: { code: 'PGRST202' }, status: 404 } }),
    });

    expect(switchIns.status).toBe('not-enough-data');
    expect(switchIns.switchIns).toEqual([]);
    expect(console.warn).toHaveBeenCalledWith(jasmine.stringMatching(/read_hero_switch_ins is not in the database/));
  });

  it('shows the switch-ins without a comparison while read_hero_matchups is missing', async () => {
    const switchIns = await getHeroSwitchIns({
      ...options,
      fetch: answering({ ...allFunctions, read_hero_matchups: { body: { code: 'PGRST202' }, status: 404 } }),
    });

    expect(switchIns.status).toBe('ready');
    expect(switchIns.switchIns.every((line) => line.overall === null)).toBeTrue();
  });

  it('still fails on a refused call', async () => {
    await expectAsync(
      getHeroSwitchIns({ ...options, fetch: answering({ ...allFunctions, read_hero_stats: { body: { code: '42501' }, status: 401 } }) }),
    ).toBeRejectedWithError('read_hero_stats answered 401');
  });
});

describe('fetchHeroSwitchInRows', () => {
  it('posts the modes to the read function with the publishable key', async () => {
    const seen: { url: string; init?: RequestInit }[] = [];

    await fetchHeroSwitchInRows(ENV, answering({ read_hero_switch_ins: { body: { switch_ins: [] } } }, seen));

    expect(seen[0].url).toBe('https://example.supabase.co/rest/v1/rpc/read_hero_switch_ins');
    expect(seen[0].init?.method).toBe('POST');
    expect(JSON.parse(String(seen[0].init?.body))).toEqual({ p_play_mode_ids: [0, 1] });
    expect((seen[0].init?.headers as Record<string, string>)['apikey']).toBe(ENV.SUPABASE_PUBLISHABLE_KEY);
  });

  it('names every missing variable and never a key value', async () => {
    await expectAsync(fetchHeroSwitchInRows({}, answering({}))).toBeRejectedWithError(
      'Hero switch-ins are not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.',
    );
  });

  it('rejects an answer that is not the expected shape', async () => {
    await expectAsync(fetchHeroSwitchInRows(ENV, answering({ read_hero_switch_ins: { body: [] } }))).toBeRejected();
    await expectAsync(fetchHeroSwitchInRows(ENV, answering({ read_hero_switch_ins: { body: {} } }))).toBeRejected();
    await expectAsync(
      fetchHeroSwitchInRows(ENV, answering({ read_hero_switch_ins: { body: { switch_ins: [{ hero_id: 'x' }] } } })),
    ).toBeRejected();
  });
});

describe('parseHeroSwitchInRows', () => {
  it('keeps the known fields and nothing else', () => {
    const [first] = parseHeroSwitchInRows(switchInAnswer());

    expect(Object.keys(first).sort()).toEqual(['enemyGameHeroId', 'gameHeroId', 'halfSeason', 'matches', 'switches', 'wins']);
  });
});
