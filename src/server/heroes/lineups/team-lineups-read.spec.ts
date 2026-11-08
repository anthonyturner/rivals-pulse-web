import { fetchTeamLineupRows, getTeamLineups, parseTeamLineupRows } from './team-lineups-read';

const ENV = { SUPABASE_URL: 'https://example.supabase.co/', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-only' };
const NOW = () => new Date('2026-11-07T12:00:00Z');

/** One row of `read_team_lineup_shapes()`, with extra keys that no allow-list should let through. */
function shapeRow(shape: [number, number, number] | null, teams: number | null, extra: Record<string, unknown> = {}) {
  return {
    half_season: 10.5,
    rank_bucket: -1,
    vanguards: shape?.[0] ?? null,
    duelists: shape?.[1] ?? null,
    strategists: shape?.[2] ?? null,
    teams,
    wins: teams === null ? null : Math.floor(teams / 2),
    enough_data: teams !== null,
    classified_teams: 1000,
    unclassified_teams: 40,
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

/** Answers each Postgres function by name as the Supabase REST layer would. */
function answering(functions: Record<string, { body: unknown; status?: number }>, seen: Seen[] = []): typeof fetch {
  return async (input, init) => {
    const url = new URL(String(input));
    seen.push({ url: String(input), init });
    const answer = functions[url.pathname.split('/rpc/')[1]];

    return new Response(JSON.stringify(answer?.body ?? {}), { status: answer?.status ?? 200 });
  };
}

const bothFunctions = {
  read_team_lineup_shapes: { body: [shapeRow([1, 2, 3], 250), shapeRow([2, 2, 2], 600), shapeRow([3, 2, 1], null)] },
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
  'minimumTeams',
  'halfSeason',
  'inPlaceOf',
  'id',
  'label',
  'startsAt',
  'endsAt',
  'classifiedTeams',
  'unclassifiedTeams',
  'shapes',
  'shape',
  'vanguards',
  'duelists',
  'strategists',
  'teams',
  'wins',
  'pickRate',
  'winRate',
]);

describe('getTeamLineups', () => {
  const options = { env: ENV, now: NOW };

  it('returns only allow-listed keys, whatever else the database function sends', async () => {
    const lineups = await getTeamLineups({ ...options, fetch: answering(bothFunctions) });

    expect([...new Set(keysOf(lineups))].filter((key) => !ALLOWED_KEYS.has(key))).toEqual([]);
    expect(JSON.stringify(lineups)).not.toMatch(/secret|uid|a player|recorded|fingerprint/);
  });

  it('derives the shapes, with a thin one listed without figures', async () => {
    const lineups = await getTeamLineups({ ...options, fetch: answering(bothFunctions) });

    expect(lineups.status).toBe('ready');
    expect(lineups.shapes.map((shape) => [shape.shape, shape.status, shape.teams])).toEqual([
      ['2-2-2', 'ready', 600],
      ['1-2-3', 'ready', 250],
      ['3-2-1', 'not-enough-data', null],
    ]);
    expect([lineups.classifiedTeams, lineups.unclassifiedTeams]).toEqual([1000, 40]);
  });

  it('answers the empty state when the database has no shape', async () => {
    const lineups = await getTeamLineups({
      ...options,
      fetch: answering({ read_team_lineup_shapes: { body: [] }, read_hero_stats: { body: statsAnswer } }),
    });

    expect(lineups.status).toBe('not-enough-data');
    expect(lineups.shapes).toEqual([]);
  });

  it('fails the request when the database refuses, without echoing the key', async () => {
    await expectAsync(
      getTeamLineups({ ...options, fetch: answering({ ...bothFunctions, read_team_lineup_shapes: { body: {}, status: 401 } }) }),
    ).toBeRejectedWithError('read_team_lineup_shapes answered 401');
  });

  it('is the empty state, not an error, while read_team_lineup_shapes is not in the database', async () => {
    const warn = spyOn(console, 'warn');

    const lineups = await getTeamLineups({
      ...options,
      fetch: answering({ ...bothFunctions, read_team_lineup_shapes: { body: { code: 'PGRST202' }, status: 404 } }),
    });

    expect(lineups.status).toBe('not-enough-data');
    expect(warn).toHaveBeenCalledWith(jasmine.stringMatching(/read_team_lineup_shapes is not in the database/));
  });
});

describe('fetchTeamLineupRows', () => {
  it('posts Competitive to the read function with the publishable key, asking only for rows with no rank', async () => {
    const seen: Seen[] = [];

    await fetchTeamLineupRows(ENV, answering({ read_team_lineup_shapes: { body: [] } }, seen));

    expect(seen[0].url).toBe('https://example.supabase.co/rest/v1/rpc/read_team_lineup_shapes?limit=1000&offset=0&rank_bucket=eq.-1');
    expect(seen[0].init?.method).toBe('POST');
    expect(JSON.parse(String(seen[0].init?.body))).toEqual({ p_play_mode_ids: [1] });
    expect((seen[0].init?.headers as Record<string, string>)['apikey']).toBe(ENV.SUPABASE_PUBLISHABLE_KEY);
  });

  it('refuses a full page rather than reading it as the whole answer', async () => {
    const full = Array.from({ length: 1000 }, (_, index) => shapeRow([index, 0, 0], 300));

    await expectAsync(fetchTeamLineupRows(ENV, answering({ read_team_lineup_shapes: { body: full } }))).toBeRejectedWithError(
      /more than a page/,
    );
  });

  it('names every missing variable and never a key value', async () => {
    await expectAsync(fetchTeamLineupRows({}, answering({}))).toBeRejectedWithError(
      'Team line-ups are not configured. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY.',
    );
  });

  it('rejects an answer that is not the expected shape', async () => {
    await expectAsync(fetchTeamLineupRows(ENV, answering({ read_team_lineup_shapes: { body: {} } }))).toBeRejected();
    await expectAsync(
      fetchTeamLineupRows(ENV, answering({ read_team_lineup_shapes: { body: [{ vanguards: 'x' }] } })),
    ).toBeRejected();
    await expectAsync(
      fetchTeamLineupRows(ENV, answering({ read_team_lineup_shapes: { body: [shapeRow([1, 2, 3], 250, { enough_data: 'yes' })] } })),
    ).toBeRejected();
  });
});

describe('parseTeamLineupRows', () => {
  it('keeps the known fields and nothing else', () => {
    const [first] = parseTeamLineupRows([shapeRow([1, 2, 3], 250)]);

    expect(Object.keys(first).sort()).toEqual([
      'classifiedTeams',
      'enoughData',
      'halfSeason',
      'rankBucket',
      'shape',
      'teams',
      'unclassifiedTeams',
      'wins',
    ]);
  });

  it('reads the row of a half-season with no shape, and the figures a thin shape withholds, as null', () => {
    const [noShape, thin] = parseTeamLineupRows([shapeRow(null, null), shapeRow([3, 2, 1], null)]);

    expect(noShape.shape).toBeNull();
    expect(thin.shape).toEqual({ vanguards: 3, duelists: 2, strategists: 1 });
    expect([thin.teams, thin.wins, thin.enoughData]).toEqual([null, null, false]);
  });
});
