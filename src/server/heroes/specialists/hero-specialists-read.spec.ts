import { fakeSupabaseClient } from '../../supabase/fake-supabase-client';
import { fetchHeroSpecialistRows, getHeroSpecialists, parseHeroSpecialistRows } from './hero-specialists-read';

const ENV = { SUPABASE_URL: 'https://example.supabase.co/', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test-only' };
const NOW = () => new Date('2026-11-11T12:00:00Z');

/** What `read_hero_specialists()` answers, with extra keys that no allow-list should let through. */
function specialistAnswer(): Record<string, unknown>[] {
  const line = (heroId: number, specialistMatches: number, specialistWins: number, flexMatches: number, flexWins: number) => ({
    half_season: 10.5,
    hero_id: heroId,
    specialist_matches: specialistMatches,
    specialist_wins: specialistWins,
    flex_matches: flexMatches,
    flex_wins: flexWins,
    uid: 'secret-uid',
    name: 'a player',
    fingerprint: 'abc',
    recorders: 3,
    people: 9,
  });

  return [line(1011, 60, 36, 120, 54), line(0, 70, 35, 70, 35)];
}

/** What `read_hero_stats()` answers: hulk and Peni Parker with a record, 12 and 40 lines. */
function statsAnswer(): Record<string, unknown> {
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
    recorders: 4,
    blended_recorders: 4,
  });

  return {
    half_seasons: [{ half_season: 10.5, starts_at: '2026-10-09T09:00:00Z' }],
    totals: [{ half_season: 10.5, play_mode_id: 1, decided_matches: 400 }],
    heroes: [line(1011, 200, 100), line(1042, 150, 75)],
  };
}

function statsFetch(body: unknown = statsAnswer()): typeof fetch {
  return async () => new Response(JSON.stringify(body), { status: 200 });
}

function failure(code: string, message = 'boom') {
  return { error: { message, code } as { message: string } };
}

const roles = async () => new Map([['hulk', 'Vanguard'], ['peni-parker', 'Vanguard']]);

describe('parseHeroSpecialistRows', () => {
  it('maps the answer onto the rows and ignores any field it does not know', () => {
    expect(parseHeroSpecialistRows(specialistAnswer())).toEqual([
      { halfSeason: 10.5, gameHeroId: 1011, specialistMatches: 60, specialistWins: 36, flexMatches: 120, flexWins: 54 },
      { halfSeason: 10.5, gameHeroId: 0, specialistMatches: 70, specialistWins: 35, flexMatches: 70, flexWins: 35 },
    ]);
  });

  it('reads an empty answer as no rows', () => {
    expect(parseHeroSpecialistRows([])).toEqual([]);
  });

  it('rejects an answer it cannot trust', () => {
    expect(() => parseHeroSpecialistRows({})).toThrowError(/the answer is not a list/);
    expect(() => parseHeroSpecialistRows([{ half_season: 10.5 }])).toThrowError(/hero_id is not a number/);
    expect(() => parseHeroSpecialistRows([{ ...specialistAnswer()[0], flex_wins: '54' }])).toThrowError(/flex_wins is not a number/);
  });
});

describe('fetchHeroSpecialistRows', () => {
  it('calls the one read function and nothing else', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({ data: specialistAnswer() }));

    expect((await fetchHeroSpecialistRows(client)).length).toBe(2);
    expect(calls.length).toBe(1);
    expect(calls[0].steps[0]).toEqual(['rpc', ['read_hero_specialists', undefined]]);
  });

  it('answers no rows while the migration has not been applied', async () => {
    spyOn(console, 'warn');

    for (const code of ['PGRST202', '42883']) {
      const { client } = fakeSupabaseClient(() => failure(code));

      expect(await fetchHeroSpecialistRows(client)).toEqual([]);
    }
  });

  it('throws any other failure, so an outage is never an empty state', async () => {
    const { client } = fakeSupabaseClient(() => failure('57014', 'timeout'));

    await expectAsync(fetchHeroSpecialistRows(client)).toBeRejectedWithError(/read_hero_specialists failed \(57014\): timeout/);
  });
});

describe('getHeroSpecialists', () => {
  const options = { env: ENV, now: NOW, loadHeroRoles: roles };

  it('derives the figures beside the hero stats of the same half-season and leaves out hero id 0 with a warning', async () => {
    const warn = spyOn(console, 'warn');
    const { client } = fakeSupabaseClient(() => ({ data: specialistAnswer() }));

    const specialists = await getHeroSpecialists({ ...options, client, fetch: statsFetch() });

    expect(specialists.status).toBe('ready');
    expect(specialists.halfSeason?.id).toBe(10.5);
    expect(specialists.heroes.map((hero) => `${hero.hero}:${hero.status}`)).toEqual(['hulk:ready', 'peni-parker:not-enough-data']);
    expect(specialists.heroes[0].specialist?.winRate).toBe(60);
    expect(warn).toHaveBeenCalledWith(jasmine.stringMatching(/ids with no hero mapping: 0$/));
  });

  it('publishes no uid, name, fingerprint or count of people whatever else the database sends', async () => {
    const { client } = fakeSupabaseClient(() => ({ data: specialistAnswer() }));

    const specialists = await getHeroSpecialists({ ...options, client, fetch: statsFetch() });

    expect(JSON.stringify(specialists)).not.toMatch(/secret|uid|fingerprint|a player|recorders|people|specialistMatches|flexWins/);
  });

  it('answers the empty state, with the heroes seen, when the database has no pair', async () => {
    const { client } = fakeSupabaseClient(() => ({ data: [] }));

    const specialists = await getHeroSpecialists({ ...options, client, fetch: statsFetch() });

    expect(specialists.status).toBe('not-enough-data');
    expect(specialists.heroes.map((hero) => hero.status)).toEqual(['not-enough-data', 'not-enough-data']);
  });

  it('answers the empty state, not an error, while read_hero_specialists is not in the database', async () => {
    spyOn(console, 'warn');
    const { client } = fakeSupabaseClient(() => failure('PGRST202'));

    const specialists = await getHeroSpecialists({ ...options, client, fetch: statsFetch() });

    expect(specialists.status).toBe('not-enough-data');
  });

  it('answers the empty state before any half-season exists, reading no hero stats', async () => {
    const { client } = fakeSupabaseClient(() => ({ data: [] }));

    const specialists = await getHeroSpecialists({
      ...options,
      client,
      fetch: statsFetch({ half_seasons: [], totals: [], heroes: [] }),
    });

    expect(specialists).toEqual(jasmine.objectContaining({ status: 'not-enough-data', halfSeason: null, heroes: [] }));
  });

  it('fails the request when the database refuses', async () => {
    const { client } = fakeSupabaseClient(() => failure('42501', 'permission denied'));

    await expectAsync(getHeroSpecialists({ ...options, client, fetch: statsFetch() })).toBeRejectedWithError(
      /read_hero_specialists failed \(42501\)/,
    );
  });
});
