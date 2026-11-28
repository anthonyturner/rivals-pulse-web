import {
  FIGURES_FUNCTION,
  HERO_SCORES_FUNCTION,
  KILL_FEED_FUNCTION,
  getCommunityFigures,
  getCommunityHeroScores,
  getCommunityKills,
  parseCommunityFiguresSource,
  parseCommunityKillsSource,
  parseHeroScoresSource,
} from './community-extended-read';
import { fakeSupabaseClient, type FakeResponse } from '../../supabase/fake-supabase-client';

const NOW = () => new Date('2026-10-30T12:00:00Z');
const HALF_SEASONS = [{ half_season: 10.5, starts_at: '2026-10-09T09:00:00+00:00' }];

/** One hero's figures as the database function returns them, plus keys no allow-list should let through. */
function figureRow(heroId: number, lines: number, damageSum: number, seconds: number) {
  return {
    half_season: 10.5,
    play_mode_id: 1,
    hero_id: heroId,
    damage_sum: damageSum,
    damage_n: lines,
    damage_seconds: seconds,
    healing_sum: 0,
    healing_n: 0,
    healing_seconds: 0,
    blocked_sum: 0,
    blocked_n: 0,
    blocked_seconds: 0,
    uid: 'secret-uid',
    name: 'a player',
    fingerprint: 'abc123',
  };
}

const FIGURES_ANSWER = {
  half_seasons: HALF_SEASONS,
  // Hela (1024) and Hulk (1011) in the Duelist and Vanguard roles.
  figures: [figureRow(1024, 60, 36000, 3600), figureRow(1011, 60, 18000, 3600)],
};

const KILLS_ANSWER = {
  half_seasons: HALF_SEASONS,
  pairs: [
    { half_season: 10.5, killer_hero: 'hela', victim_hero: 'hulk', kills: 140, matches: 31, recorder: 'secret-recorder' },
    { half_season: 10.5, killer_hero: 'hulk', victim_hero: 'hela', kills: 9, matches: 9 },
  ],
};

const ROLE_BY_SLUG = new Map([
  ['hela', 'Duelist'],
  ['hulk', 'Vanguard'],
]);

function failure(code: string, message = 'boom'): FakeResponse {
  return { error: { message, code } as { message: string } };
}

describe('parseCommunityFiguresSource', () => {
  it('maps the function answer onto the derivation input and ignores any key it does not know', () => {
    const parsed = parseCommunityFiguresSource(FIGURES_ANSWER);

    expect(parsed.halfSeasons).toEqual([{ halfSeason: 10.5, startsAt: '2026-10-09T09:00:00+00:00' }]);
    expect(parsed.figures[0]).toEqual({
      halfSeason: 10.5,
      playModeId: 1,
      gameHeroId: 1024,
      damageSum: 36000,
      damageN: 60,
      damageSeconds: 3600,
      healingSum: 0,
      healingN: 0,
      healingSeconds: 0,
      blockedSum: 0,
      blockedN: 0,
      blockedSeconds: 0,
    });
    expect(JSON.stringify(parsed)).not.toMatch(/secret-uid|a player|abc123/);
  });

  it('accepts an answer with nothing counted', () => {
    expect(parseCommunityFiguresSource({ half_seasons: [], figures: [] }).figures).toEqual([]);
  });

  it('rejects an answer it cannot trust', () => {
    expect(() => parseCommunityFiguresSource(null)).toThrowError(/did not return an object/);
    expect(() => parseCommunityFiguresSource({ ...FIGURES_ANSWER, figures: 'none' })).toThrowError(/figures is not a list/);
    expect(() =>
      parseCommunityFiguresSource({ ...FIGURES_ANSWER, figures: [{ ...FIGURES_ANSWER.figures[0], damage_sum: '36000' }] }),
    ).toThrowError(/damage_sum is not a number/);
    expect(() =>
      parseCommunityFiguresSource({ ...FIGURES_ANSWER, figures: [{ ...FIGURES_ANSWER.figures[0], damage_seconds: null }] }),
    ).toThrowError(/damage_seconds is not a number/);
  });
});

describe('parseCommunityKillsSource', () => {
  it('maps the function answer onto the derivation input and ignores any key it does not know', () => {
    const parsed = parseCommunityKillsSource(KILLS_ANSWER);

    expect(parsed.pairs[0]).toEqual({
      halfSeason: 10.5,
      killerHero: 'hela',
      victimHero: 'hulk',
      kills: 140,
      matches: 31,
    });
    expect(JSON.stringify(parsed)).not.toMatch(/secret-recorder/);
  });

  it('rejects an answer it cannot trust', () => {
    expect(() => parseCommunityKillsSource([])).toThrowError(/did not return an object/);
    expect(() => parseCommunityKillsSource({ ...KILLS_ANSWER, pairs: [{ ...KILLS_ANSWER.pairs[0], kills: 'many' }] })).toThrowError(
      /kills is not a number/,
    );
    expect(() => parseCommunityKillsSource({ ...KILLS_ANSWER, pairs: [{ ...KILLS_ANSWER.pairs[0], killer_hero: 7 }] })).toThrowError(
      /killer_hero is not a string/,
    );
  });
});

describe('getCommunityFigures', () => {
  const loadHeroRoles = async () => ROLE_BY_SLUG;

  beforeEach(() => spyOn(console, 'warn'));

  it('calls the one read function and nothing else', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({ data: FIGURES_ANSWER }));

    await getCommunityFigures({ client, now: NOW, loadHeroRoles });

    expect(calls.length).toBe(1);
    expect(calls[0].steps[0]).toEqual(['rpc', [FIGURES_FUNCTION, undefined]]);
  });

  it('derives the per-minute rates per role and per hero', async () => {
    const { client } = fakeSupabaseClient(() => ({ data: FIGURES_ANSWER }));

    const figures = await getCommunityFigures({ client, now: NOW, loadHeroRoles });
    const blend = figures.modes[0];

    expect(figures.status).toBe('ready');
    expect(blend.roles.find((entry) => entry.role === 'Duelist')?.damage).toBe(600);
    expect(blend.roles.find((entry) => entry.role === 'Vanguard')?.damage).toBe(300);
    expect(blend.heroes.map((entry) => [entry.hero, entry.damage])).toEqual([
      ['hela', 600],
      ['hulk', 300],
    ]);
    expect(blend.roles.find((entry) => entry.role === 'Duelist')?.healing).toBeNull();
  });

  it('returns only allow-listed keys, whatever else the database function sends', async () => {
    const { client } = fakeSupabaseClient(() => ({ data: FIGURES_ANSWER }));

    const figures = await getCommunityFigures({ client, now: NOW, loadHeroRoles });
    const allowed = new Set([
      'status', 'minimums', 'roleLines', 'heroLines', 'recorders', 'halfSeasons', 'halfSeason', 'inPlaceOf',
      'id', 'label', 'startsAt', 'endsAt', 'modes', 'roles', 'heroes', 'role', 'hero', 'damage', 'healing', 'blocked',
    ]);

    expect([...new Set(keysOf(figures))].filter((key) => !allowed.has(key))).toEqual([]);
    expect(JSON.stringify(figures)).not.toMatch(/secret-uid|a player|abc123|uid|fingerprint/);
  });

  it('is the designed empty state, not an error, while the read function is not there yet', async () => {
    for (const code of ['PGRST202', '42883', '42P01']) {
      const { client } = fakeSupabaseClient(() => failure(code));
      const loadRoles = jasmine.createSpy('loadHeroRoles').and.resolveTo(ROLE_BY_SLUG);

      const figures = await getCommunityFigures({ client, now: NOW, loadHeroRoles: loadRoles });

      expect(figures.status).toBe('not-enough-data');
      expect(figures.halfSeason).toBeNull();
      expect(figures.modes[0].heroes).toEqual([]);
      expect(loadRoles).not.toHaveBeenCalled();
    }
  });

  it('is the empty state when the tables have no row yet, without reading roles', async () => {
    const { client } = fakeSupabaseClient(() => ({ data: { half_seasons: HALF_SEASONS, figures: [] } }));
    const loadRoles = jasmine.createSpy('loadHeroRoles').and.resolveTo(ROLE_BY_SLUG);

    const figures = await getCommunityFigures({ client, now: NOW, loadHeroRoles: loadRoles });

    expect(figures.status).toBe('not-enough-data');
    expect(figures.halfSeason?.id).toBe(10.5);
    expect(loadRoles).not.toHaveBeenCalled();
  });

  it('raises any other failure, naming the code but not the data', async () => {
    for (const code of ['401', '57014', 'PGRST301']) {
      const { client } = fakeSupabaseClient(() => failure(code, 'canceling statement'));

      await expectAsync(getCommunityFigures({ client, now: NOW, loadHeroRoles })).toBeRejectedWithError(
        `${FIGURES_FUNCTION} failed (${code}): canceling statement`,
      );
    }
  });

  it('passes the asked half-season to the derivation', async () => {
    const { client } = fakeSupabaseClient(() => ({ data: FIGURES_ANSWER }));

    const figures = await getCommunityFigures({ client, now: NOW, loadHeroRoles, halfSeason: 11 });

    expect(figures.halfSeason).toBeNull();
  });
});

/** A hero below the rule as the database function returns it, plus keys no allow-list should let through. */
const HERO_SCORES_ANSWER = {
  half_seasons: HALF_SEASONS,
  figures: [
    {
      half_season: 10.5,
      play_mode_id: 1,
      hero_id: 1024,
      damage_n: 7,
      damage_recorders: 2,
      damage_busiest_above_half: false,
      damage_qualifies: false,
      damage_sum: 0,
      damage_seconds: 0,
      healing_n: 0,
      healing_recorders: 0,
      healing_busiest_above_half: false,
      healing_qualifies: false,
      healing_sum: 0,
      healing_seconds: 0,
      blocked_n: 0,
      blocked_recorders: 0,
      blocked_busiest_above_half: false,
      blocked_qualifies: false,
      blocked_sum: 0,
      blocked_seconds: 0,
      uid: 'secret-uid',
    },
  ],
  abilities: [
    {
      half_season: 10.5,
      play_mode_id: 1,
      hero_id: 1024,
      slot: 'ultimate',
      segments: 3,
      recorders: 1,
      busiest_above_half: true,
      qualifies: false,
      uses_sum: 0,
      uses_timed_sum: 0,
      seconds_sum: 0,
      kills_after_sum: 0,
      kills_after_n: 0,
      assists_after_sum: 0,
      assists_after_n: 0,
      name: 'a player',
    },
  ],
};

describe('parseHeroScoresSource', () => {
  it('maps the function answer onto the derivation input and ignores any key it does not know', () => {
    const source = parseHeroScoresSource(HERO_SCORES_ANSWER);

    expect(source.figures[0].damage).toEqual({ lines: 7, contributors: 2, busiestAboveHalf: false, qualifies: false, sum: 0, seconds: 0 });
    expect(source.abilities[0]).toEqual(jasmine.objectContaining({ gameHeroId: 1024, slot: 'ultimate', lines: 3, contributors: 1, busiestAboveHalf: true }));
    expect(keysOf(source)).not.toContain('uid');
    expect(keysOf(source)).not.toContain('name');
  });

  it('rejects an answer it cannot trust', () => {
    const [figure] = HERO_SCORES_ANSWER.figures;

    expect(() => parseHeroScoresSource(null)).toThrowError(/read_community_hero_scores/);
    expect(() => parseHeroScoresSource({ ...HERO_SCORES_ANSWER, abilities: 'x' })).toThrowError(/abilities is not a list/);
    expect(() => parseHeroScoresSource({ ...HERO_SCORES_ANSWER, figures: [{ ...figure, damage_qualifies: 1 }] })).toThrowError(/damage_qualifies is not true or false/);
  });
});

describe('getCommunityHeroScores', () => {
  it('calls the one read function and says how far along a hero below the rule is', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({ data: HERO_SCORES_ANSWER }));
    const scores = await getCommunityHeroScores({ client, now: NOW });

    expect(calls.length).toBe(1);
    expect(calls[0].steps[0]).toEqual(['rpc', [HERO_SCORES_FUNCTION, undefined]]);
    expect(scores.status).toBe('not-enough-data');
    expect(scores.heroes[0].hero).toBe('hela');
    expect(scores.heroes[0].damage).toEqual(jasmine.objectContaining({ status: 'collecting', score: null, matches: 5, contributors: 2 }));
    expect(scores.heroes[0].ultimate).toEqual(jasmine.objectContaining({ status: 'collecting', matches: 0, contributors: 1, oneContributorAboveHalf: true }));
    expect(keysOf(scores)).not.toContain('uid');
    expect(keysOf(scores)).not.toContain('name');
  });

  it('is the designed empty state, not an error, while the read function is not there yet', async () => {
    spyOn(console, 'warn');
    const { client } = fakeSupabaseClient(() => failure('PGRST202'));
    const scores = await getCommunityHeroScores({ client, now: NOW });

    expect(scores).toEqual(jasmine.objectContaining({ status: 'not-enough-data', heroes: [], halfSeason: null }));
  });

  it('raises any other failure', async () => {
    const { client } = fakeSupabaseClient(() => failure('500'));

    await expectAsync(getCommunityHeroScores({ client, now: NOW })).toBeRejectedWithError(/read_community_hero_scores failed/);
  });
});

describe('getCommunityKills', () => {
  beforeEach(() => spyOn(console, 'warn'));

  it('calls the one read function and nothing else', async () => {
    const { client, calls } = fakeSupabaseClient(() => ({ data: KILLS_ANSWER }));

    await getCommunityKills({ client, now: NOW });

    expect(calls.length).toBe(1);
    expect(calls[0].steps[0]).toEqual(['rpc', [KILL_FEED_FUNCTION, undefined]]);
  });

  it('lists the pairs with enough matches as bands, never as exact counts', async () => {
    const { client } = fakeSupabaseClient(() => ({ data: KILLS_ANSWER }));

    const kills = await getCommunityKills({ client, now: NOW });

    expect(kills.status).toBe('ready');
    expect(kills.pairs).toEqual([{ killer: 'hela', victim: 'hulk', killsBand: 100 }]);
  });

  it('returns only allow-listed keys, whatever else the database function sends', async () => {
    const { client } = fakeSupabaseClient(() => ({ data: KILLS_ANSWER }));

    const kills = await getCommunityKills({ client, now: NOW });
    const allowed = new Set([
      'status', 'minimums', 'pairMatches', 'recorders', 'halfSeasons', 'halfSeason', 'inPlaceOf',
      'id', 'label', 'startsAt', 'endsAt', 'pairs', 'killer', 'victim', 'killsBand',
    ]);

    expect([...new Set(keysOf(kills))].filter((key) => !allowed.has(key))).toEqual([]);
    expect(JSON.stringify(kills)).not.toMatch(/secret-recorder|uid|fingerprint/);
  });

  it('is the designed empty state, not an error, while the read function is not there yet', async () => {
    for (const code of ['PGRST202', '42883', '42P01']) {
      const { client } = fakeSupabaseClient(() => failure(code));

      const kills = await getCommunityKills({ client, now: NOW });

      expect(kills.status).toBe('not-enough-data');
      expect(kills.pairs).toEqual([]);
    }
  });

  it('raises any other failure', async () => {
    const { client } = fakeSupabaseClient(() => failure('57014', 'canceling statement'));

    await expectAsync(getCommunityKills({ client, now: NOW })).toBeRejectedWithError(
      `${KILL_FEED_FUNCTION} failed (57014): canceling statement`,
    );
  });
});

function keysOf(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(keysOf);
  }

  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => [key, ...keysOf(child)]);
  }

  return [];
}
