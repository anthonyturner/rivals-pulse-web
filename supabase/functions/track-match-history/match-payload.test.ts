import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  parseParticipants,
  PayloadError,
  readHalfSeason,
  readMatchContext,
  readMatchUid,
  readPlayedAt,
  rosterFingerprint,
  storableMatch,
  type JsonRecord,
} from './match-payload.ts';

function player(overrides: JsonRecord = {}): JsonRecord {
  return { player_uid: '100', nick_name: 'Alpha', camp: 0, cur_hero_id: 1011, kills: 5, deaths: 2, assists: 7, ...overrides };
}

function match(players: JsonRecord[], overrides: JsonRecord = {}): JsonRecord {
  return {
    match_uid: 'local-1',
    match_time_stamp: 1_800_000_000,
    match_season: 10.5,
    match_player: { player_uid: '100', camp: 0, is_win: true, kills: 5, deaths: 2, assists: 7 },
    match_players: players,
    ...overrides,
  };
}

const FORBIDDEN_TERMS = ['damage', 'heal', 'accuracy', 'ult'];

describe('parseParticipants', () => {
  it('keeps the scoreboard fields and derives win or loss from the recorder side', () => {
    const rows = parseParticipants(match([player(), player({ player_uid: '200', nick_name: 'Beta', camp: 1 })]));

    assert.deepEqual(rows, [
      { uid: '100', name: 'Alpha', team: 0, hero_id: 1011, kills: 5, deaths: 2, assists: 7, final_hits: null, is_win: true },
      { uid: '200', name: 'Beta', team: 1, hero_id: 1011, kills: 5, deaths: 2, assists: 7, final_hits: null, is_win: false },
    ]);
  });

  it('never carries damage, healing, accuracy, damage blocked or ult figures from any player', () => {
    const rows = parseParticipants(match([
      player({
        total_hero_damage: 9000,
        total_hero_heal: 4000,
        total_damage_taken: 100,
        damage_blocked: 5,
        session_hit_rate: 0.5,
        ult_charge: 80,
        accuracy: 0.4,
      }),
    ]));

    const keys = rows.flatMap(row => Object.keys(row));
    for (const term of FORBIDDEN_TERMS) {
      assert.equal(keys.some(key => key.includes(term)), false, `a "${term}" field reached a row`);
    }
    assert.equal(JSON.stringify(rows).includes('9000'), false);
  });

  it('skips bots and entries with neither a uid nor a name', () => {
    const rows = parseParticipants(match([
      player(),
      player({ player_uid: '9', is_bot: true }),
      player({ player_uid: undefined, nick_name: undefined }),
    ]));

    assert.equal(rows.length, 1);
  });

  it('stores the uid alone when no in-game name is known', () => {
    const [row] = parseParticipants(match([player({ nick_name: undefined })]));

    assert.equal(row.uid, '100');
    assert.equal(row.name, null);
  });

  it('strips control characters and caps the name length', () => {
    const [row] = parseParticipants(match([player({ nick_name: `  Al\u0000pha${'x'.repeat(100)} ` })]));

    assert.equal(row.name?.includes('\u0000'), false);
    assert.equal(row.name?.length, 64);
  });

  it('leaves win or loss unknown when the recorder result or side is unknown', () => {
    const [row] = parseParticipants(match([player()], { match_player: { player_uid: '100' } }));

    assert.equal(row.is_win, null);
  });

  it('keeps one row per player when the payload repeats one', () => {
    assert.equal(parseParticipants(match([player(), player()])).length, 1);
  });

  it('refuses a payload with no roster, an oversized roster or nobody identifiable', () => {
    assert.throws(() => parseParticipants({ match_uid: 'x' }), PayloadError);
    assert.throws(
      () => parseParticipants(match(Array.from({ length: 15 }, (_, index) => player({ player_uid: String(index) })))),
      PayloadError,
    );
    assert.throws(() => parseParticipants(match([player({ player_uid: undefined, nick_name: undefined })])), PayloadError);
  });

  it('rejects out-of-range numbers instead of storing them', () => {
    const [row] = parseParticipants(match([player({ kills: -1, deaths: 1e9, assists: 1.5, camp: 'x' })]));

    assert.deepEqual([row.kills, row.deaths, row.assists, row.team], [null, null, null, null]);
    assert.equal(parseParticipants(match([player({ cur_hero_id: 2_147_483_648 })]))[0].hero_id, null);
  });

  it('keeps Final Hits for every player, on both teams', () => {
    const rows = parseParticipants(match([
      player({ final_hits: 3 }),
      player({ player_uid: '200', nick_name: 'Beta', camp: 1, final_hits: 0 }),
    ]));

    assert.deepEqual(rows.map(row => row.final_hits), [3, 0]);
  });

  it('stores absent or null Final Hits as null, never 0', () => {
    const [absent] = parseParticipants(match([player()]));
    const [explicitNull] = parseParticipants(match([player({ final_hits: null })]));

    assert.equal(absent.final_hits, null);
    assert.equal(explicitNull.final_hits, null);
  });

  it('refuses invalid Final Hits the same way as the other figures', () => {
    for (const final_hits of [-1, 1.5, 1e9, 'three', '', true, {}, [2]]) {
      const [row] = parseParticipants(match([player({ final_hits })]));
      assert.equal(row.final_hits, null, `final_hits ${JSON.stringify(final_hits)} was stored`);
    }
  });
});

describe('readMatchContext', () => {
  it('reads the mode and the map of the match', () => {
    assert.deepEqual(readMatchContext(match([player()], { play_mode_id: 1, match_map_name: ' Tokyo 2099 ' })), {
      play_mode_id: 1,
      map_name: 'Tokyo 2099',
    });
  });

  it('keeps Quick Match (0) as a mode rather than reading it as missing', () => {
    assert.equal(readMatchContext(match([player()], { play_mode_id: 0 })).play_mode_id, 0);
    assert.equal(readMatchContext(match([player()], { play_mode_id: '0' })).play_mode_id, 0);
  });

  it('is null for an absent, unknown or malformed mode and map, never 0 or an empty string', () => {
    assert.deepEqual(readMatchContext(match([player()])), { play_mode_id: null, map_name: null });
    assert.deepEqual(
      readMatchContext(match([player()], { play_mode_id: null, match_map_name: '  ' })),
      { play_mode_id: null, map_name: null },
    );
    assert.deepEqual(
      readMatchContext(match([player()], { play_mode_id: -1, match_map_name: { a: 1 } })),
      { play_mode_id: null, map_name: null },
    );
    assert.equal(readMatchContext(match([player()], { play_mode_id: 100 })).play_mode_id, null);
    assert.equal(readMatchContext(match([player()], { play_mode_id: 1.5 })).play_mode_id, null);
  });

  it('caps the map name length and strips control characters like a player name', () => {
    const { map_name } = readMatchContext(match([player()], { match_map_name: `Tok\u0000yo${'x'.repeat(100)}` }));

    assert.equal(map_name?.length, 64);
    assert.equal(map_name?.startsWith('Tokyo'), true);
  });

  it('agrees with what the recorder history stores', () => {
    const upload = match([player()], { play_mode_id: 1, match_map_name: 'Tokyo 2099' });
    const { rawPayload } = storableMatch(upload);
    const { play_mode_id, map_name } = readMatchContext(upload);

    assert.equal(rawPayload['play_mode_id'], play_mode_id);
    assert.equal(rawPayload['match_map_name'], map_name);
  });
});

describe('rosterFingerprint', () => {
  it('is the same for the same players in any order, whoever recorded them', async () => {
    const forward = parseParticipants(match([player(), player({ player_uid: '200', nick_name: 'Beta' })]));
    const backward = parseParticipants(match([player({ player_uid: '200', nick_name: 'Beta' }), player()]));

    assert.equal(await rosterFingerprint(forward), await rosterFingerprint(backward));
  });

  it('differs when the players differ', async () => {
    const one = parseParticipants(match([player()]));
    const other = parseParticipants(match([player({ player_uid: '300' })]));

    assert.notEqual(await rosterFingerprint(one), await rosterFingerprint(other));
  });

  it('falls back to the lower-cased name when there is no uid', async () => {
    const upper = parseParticipants(match([player({ player_uid: undefined, nick_name: 'ALPHA' })]));
    const lower = parseParticipants(match([player({ player_uid: undefined, nick_name: 'alpha' })]));

    assert.equal(await rosterFingerprint(upper), await rosterFingerprint(lower));
  });

  it('is unchanged when a late result arrives, so the re-send finds the stored rows (issue 785)', async () => {
    const players = [player(), player({ player_uid: '200', nick_name: 'Beta', camp: 1 })];
    const noResult = parseParticipants(match(players, { match_player: { player_uid: '100', camp: 0 } }));
    const withResult = parseParticipants(match(players));

    assert.deepEqual(noResult.map(row => row.is_win), [null, null]);
    assert.deepEqual(withResult.map(row => row.is_win), [true, false]);
    assert.equal(await rosterFingerprint(noResult), await rosterFingerprint(withResult));
  });
});

describe('storableMatch', () => {
  it('drops other players and every detailed figure of the recorder', () => {
    const { rawPayload, performance } = storableMatch(match([player()], {
      match_player: {
        player_uid: '100',
        camp: 0,
        is_win: true,
        kills: 5,
        deaths: 2,
        assists: 7,
        player_hero: { hero_name: 'Hulk', total_hero_damage: 9000, total_hero_heal: 4000 },
      },
      player_performance: { damage: 1 },
    }));

    assert.equal('match_players' in rawPayload, false);
    assert.equal('player_performance' in rawPayload, false);
    assert.deepEqual(performance, {
      player_uid: '100',
      kills: 5,
      deaths: 2,
      assists: 7,
      is_win: true,
      camp: 0,
      player_hero: { hero_name: 'Hulk' },
    });
  });

  it("keeps the recorder's Final Hits, and leaves them out when not counted", () => {
    const counted = storableMatch(match([player()], { match_player: { player_uid: '100', final_hits: 0 } }));
    const notCounted = storableMatch(match([player()], { match_player: { player_uid: '100', final_hits: 'x' } }));

    assert.equal(counted.performance?.['final_hits'], 0);
    assert.equal(notCounted.performance !== null && 'final_hits' in notCounted.performance, false);
  });

  it('drops nested values smuggled into the match facts', () => {
    const nested = { match_players: [{ total_hero_damage: 9000 }] };
    const { rawPayload } = storableMatch(match([player()], {
      match_map_name: nested,
      match_play_duration: nested,
      play_mode_id: nested,
      match_uid: 'local-1',
    }));

    assert.equal(JSON.stringify(rawPayload).includes('9000'), false);
    assert.equal('match_map_name' in rawPayload, false);
  });

  it('refuses an over-long or non-text match id', () => {
    assert.throws(() => readMatchUid({ match_uid: 'x'.repeat(65) }), PayloadError);
    assert.throws(() => readMatchUid({ match_uid: { a: 1 } }), PayloadError);
    assert.equal(readMatchUid({ match_uid: ' local-1 ' }), 'local-1');
  });

  it('keeps the match facts', () => {
    const { rawPayload } = storableMatch(match([player()], { match_map_name: 'Tokyo 2099', play_mode_id: 1 }));

    assert.equal(rawPayload['match_uid'], 'local-1');
    assert.equal(rawPayload['match_map_name'], 'Tokyo 2099');
    assert.equal(rawPayload['play_mode_id'], 1);
  });
});

describe('readHalfSeason and readPlayedAt', () => {
  it('accepts whole and half seasons only', () => {
    assert.equal(readHalfSeason({ match_season: 10 }), 10);
    assert.equal(readHalfSeason({ match_season: '10.5' }), 10.5);
    assert.throws(() => readHalfSeason({ match_season: 10.3 }), PayloadError);
    assert.throws(() => readHalfSeason({}), PayloadError);
    assert.throws(() => readHalfSeason({ match_season: null }), PayloadError);
    assert.throws(() => readHalfSeason({ match_season: '' }), PayloadError);
  });

  it('accepts a recent match and refuses an old or future one', () => {
    const now = Date.parse('2026-10-09T12:00:00Z');
    const seconds = (iso: string) => Date.parse(iso) / 1000;

    assert.equal(readPlayedAt({ match_time_stamp: seconds('2026-10-09T11:50:00Z') }, now), '2026-10-09T11:50:00.000Z');
    assert.throws(() => readPlayedAt({ match_time_stamp: seconds('2026-09-01T00:00:00Z') }, now), PayloadError);
    assert.throws(() => readPlayedAt({ match_time_stamp: seconds('2026-10-10T00:00:00Z') }, now), PayloadError);
    assert.throws(() => readPlayedAt({}, now), PayloadError);
  });
});
