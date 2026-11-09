import { fakeSupabaseClient } from '../supabase/fake-supabase-client';
import { getGameCounts, parseGameCounts } from './game-counts-read';

const ANSWER = {
  matches: 733,
  players: 7674,
  since: '2026-09-20T02:12:49+00:00',
  half_seasons: [
    { half_season: 10.5, matches: 436, players: 4546 },
    { half_season: 10, matches: 297, players: 3165 },
  ],
};

function failure(code: string, message = 'boom') {
  return { error: { message, code } as { message: string } };
}

describe('parseGameCounts', () => {
  it('maps the function answer onto the contract, with the time in ISO form', () => {
    expect(parseGameCounts(ANSWER)).toEqual({
      matches: 733,
      players: 7674,
      since: '2026-09-20T02:12:49.000Z',
      halfSeasons: [
        { halfSeason: 10.5, matches: 436, players: 4546 },
        { halfSeason: 10, matches: 297, players: 3165 },
      ],
    });
  });

  it('reads nothing counted as zero with no start time', () => {
    expect(parseGameCounts({ matches: 0, players: 0, since: null, half_seasons: [] })).toEqual({
      matches: 0,
      players: 0,
      since: null,
      halfSeasons: [],
    });
  });

  it('ignores a field it does not know, so a later column cannot leak into the payload', () => {
    const parsed = parseGameCounts({
      ...ANSWER,
      uid: '4242',
      half_seasons: [{ ...ANSWER.half_seasons[0], name: 'someone' }],
    });

    expect(Object.keys(parsed).sort()).toEqual(['halfSeasons', 'matches', 'players', 'since']);
    expect(Object.keys(parsed.halfSeasons[0]).sort()).toEqual(['halfSeason', 'matches', 'players']);
  });

  it('rejects an answer it cannot trust', () => {
    expect(() => parseGameCounts(null)).toThrowError(/did not return an object/);
    expect(() => parseGameCounts({ ...ANSWER, matches: '733' })).toThrowError(/matches is not a number/);
    expect(() => parseGameCounts({ ...ANSWER, half_seasons: 'none' })).toThrowError(/half_seasons is not a list/);
    expect(() => parseGameCounts({ ...ANSWER, half_seasons: [{ half_season: 10, matches: 1 }] })).toThrowError(
      /players is not a number/,
    );
    expect(() => parseGameCounts({ ...ANSWER, since: 'yesterday' })).toThrowError(/since is not a timestamp/);
    expect(() => parseGameCounts({ ...ANSWER, since: 7 })).toThrowError(/since is not a timestamp/);
  });
});

describe('getGameCounts', () => {
  it('calls the one read function and nothing else', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({ data: ANSWER }));

    const counts = await getGameCounts(client);

    expect(counts.matches).toBe(733);
    expect(calls.length).toBe(1);
    expect(calls[0].steps[0]).toEqual(['rpc', ['read_game_counts', undefined]]);
  });

  it('answers the empty counts while the migration has not been applied', async () => {
    spyOn(console, 'warn');

    for (const code of ['PGRST202', '42883', '42P01']) {
      const { client } = fakeSupabaseClient(() => failure(code));

      expect(await getGameCounts(client)).toEqual({ matches: 0, players: 0, since: null, halfSeasons: [] });
    }
  });

  it('throws any other failure, naming the function and the code, so an outage is never an empty page', async () => {
    const { client } = fakeSupabaseClient(() => failure('57014', 'timeout'));

    await expectAsync(getGameCounts(client)).toBeRejectedWithError(/read_game_counts failed \(57014\): timeout/);
  });
});
