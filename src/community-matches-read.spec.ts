import { fakeSupabaseClient } from './fake-supabase-client';
import {
  fetchCommunityMatchesSource,
  getCommunityMatches,
  parseCommunityMatchesSource,
} from './community-matches-read';

const ANSWER = {
  half_seasons: [{ half_season: 10.5, starts_at: '2026-10-09T09:00:00+00:00' }],
  modes: [{ half_season: 10.5, play_mode_id: 0, matches: 30, duration_sum_seconds: 18000, duration_n: 30 }],
  maps: [{ half_season: 10.5, play_mode_id: 0, map_name: 'Tokyo 2099', matches: 30, decided_matches: 12, wins: 6 }],
  days: [{ half_season: 10.5, day: '2026-10-29', matches: 30 }],
};
const NOW = () => new Date('2026-10-30T12:00:00Z');

function failure(code: string, message = 'boom') {
  return { error: { message, code } as { message: string } };
}

describe('parseCommunityMatchesSource', () => {
  it('maps the function answer onto the derivation input', () => {
    expect(parseCommunityMatchesSource(ANSWER)).toEqual({
      halfSeasons: [{ halfSeason: 10.5, startsAt: '2026-10-09T09:00:00+00:00' }],
      modes: [{ halfSeason: 10.5, playModeId: 0, matches: 30, durationSumSeconds: 18000, durationN: 30 }],
      maps: [{ halfSeason: 10.5, playModeId: 0, mapName: 'Tokyo 2099', matches: 30, decidedMatches: 12, wins: 6 }],
      days: [{ halfSeason: 10.5, day: '2026-10-29', matches: 30 }],
    });
  });

  it('ignores a field it does not know, so a later column cannot leak into the payload', () => {
    const parsed = parseCommunityMatchesSource({
      ...ANSWER,
      modes: [{ ...ANSWER.modes[0], uid: '4242', name: 'someone' }],
    });

    expect(Object.keys(parsed.modes[0]).sort()).toEqual([
      'durationN',
      'durationSumSeconds',
      'halfSeason',
      'matches',
      'playModeId',
    ]);
  });

  it('accepts an answer with nothing counted', () => {
    expect(parseCommunityMatchesSource({ half_seasons: [], modes: [], maps: [], days: [] }).modes).toEqual([]);
  });

  it('rejects an answer it cannot trust', () => {
    expect(() => parseCommunityMatchesSource(null)).toThrowError(/not an object/);
    expect(() => parseCommunityMatchesSource({ ...ANSWER, modes: 'none' })).toThrowError(/modes is not a list/);
    expect(() => parseCommunityMatchesSource({ ...ANSWER, modes: [null] })).toThrowError(/not an object/);
    expect(() =>
      parseCommunityMatchesSource({ ...ANSWER, maps: [{ ...ANSWER.maps[0], wins: '6' }] }),
    ).toThrowError(/wins is not a number/);
    expect(() =>
      parseCommunityMatchesSource({ ...ANSWER, days: [{ ...ANSWER.days[0], day: 'yesterday' }] }),
    ).toThrowError(/day is not a calendar day/);
    expect(() =>
      parseCommunityMatchesSource({ ...ANSWER, maps: [{ ...ANSWER.maps[0], map_name: 7 }] }),
    ).toThrowError(/map_name is not a string/);
  });
});

describe('fetchCommunityMatchesSource', () => {
  it('calls the one read function and nothing else', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({ data: ANSWER }));

    await fetchCommunityMatchesSource(client);

    expect(calls.length).toBe(1);
    expect(calls[0].steps[0]).toEqual(['rpc', ['read_community_matches', undefined]]);
  });

  it('answers null while the migration has not been applied', async () => {
    for (const code of ['PGRST202', '42883', '42P01']) {
      const { client } = fakeSupabaseClient(() => failure(code));

      expect(await fetchCommunityMatchesSource(client)).toBeNull();
    }
  });

  it('raises any other failure, naming the code but not the data', async () => {
    const { client } = fakeSupabaseClient(() => failure('57014', 'canceling statement'));

    await expectAsync(fetchCommunityMatchesSource(client)).toBeRejectedWithError(
      'read_community_matches failed (57014): canceling statement',
    );
  });
});

describe('getCommunityMatches', () => {
  it('derives the tab from the aggregates', async () => {
    const { client } = fakeSupabaseClient(() => ({ data: ANSWER }));

    const result = await getCommunityMatches({ client, now: NOW });

    expect(result.status).toBe('ready');
    expect(result.halfSeason?.id).toBe(10.5);
    expect(result.matchesCounted).toBe(30);
    expect(result.maps).toEqual([{ map: 'Tokyo 2099', matches: 12, wins: 6, winRate: 50 }]);
  });

  it('is the designed empty state, not an error, while the aggregates are not there yet', async () => {
    spyOn(console, 'warn');
    const { client } = fakeSupabaseClient(() => failure('PGRST202'));

    const result = await getCommunityMatches({ client, now: NOW });

    expect(result.status).toBe('not-enough-data');
    expect(result.halfSeason).toBeNull();
    expect(result.matchesCounted).toBe(0);
    expect(console.warn).toHaveBeenCalled();
  });

  it('passes the asked half-season to the derivation', async () => {
    const { client } = fakeSupabaseClient(() => ({ data: ANSWER }));

    const result = await getCommunityMatches({ client, now: NOW, halfSeason: 11 });

    expect(result.halfSeason).toBeNull();
  });
});
