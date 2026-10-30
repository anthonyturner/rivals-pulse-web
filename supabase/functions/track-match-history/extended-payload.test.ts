import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  MAX_HERO_FIGURES,
  MAX_HERO_KILL_PAIRS,
  MAX_KILLS_PER_PAIR,
  readExtendedUpload,
} from './extended-payload.ts';
import { parseParticipants, readMatchContext, rosterFingerprint, storableMatch, type JsonRecord } from './match-payload.ts';

function segment(overrides: JsonRecord = {}): JsonRecord {
  return { hero_id: 1011, seconds: 300, damage_dealt: 9000, healing: 0, damage_blocked: 1200, ...overrides };
}

function match(extra: JsonRecord = {}, localPlayer: JsonRecord = {}): JsonRecord {
  return {
    match_uid: 'local-1',
    match_player: { player_uid: '100', camp: 0, is_win: true, ...localPlayer },
    match_players: [{ player_uid: '100', nick_name: 'Alpha', camp: 0 }],
    ...extra,
  };
}

describe('readExtendedUpload', () => {
  it('is null for the payload every shipped overlay sends', () => {
    assert.equal(readExtendedUpload(match()), null);
  });

  it('reads the local player hero segments and the kill feed', () => {
    const upload = readExtendedUpload(match(
      { hero_kills: [{ killer: 'iron-man', victim: 'hulk', kills: 3 }] },
      { hero_segments: [segment(), segment({ hero_id: 1022, seconds: 120, damage_dealt: 400, healing: 7000 })] },
    ));

    assert.deepEqual(upload, {
      recorder_uid: '100',
      hero_figures: [
        { hero_id: 1011, seconds: 300, damage_dealt: 9000, healing: 0, damage_blocked: 1200 },
        { hero_id: 1022, seconds: 120, damage_dealt: 400, healing: 7000, damage_blocked: 1200 },
      ],
      hero_kills: [{ killer: 'iron-man', victim: 'hulk', kills: 3 }],
    });
  });

  it('keeps a real zero but never turns a missing figure into one', () => {
    const upload = readExtendedUpload(match({}, {
      hero_segments: [{ hero_id: 1011, seconds: 60, healing: 0 }],
    }));

    assert.deepEqual(upload?.hero_figures, [
      { hero_id: 1011, seconds: 60, damage_dealt: null, healing: 0, damage_blocked: null },
    ]);
  });

  it('drops a segment whose every figure is malformed', () => {
    const upload = readExtendedUpload(match({}, {
      hero_segments: [segment({ damage_dealt: -5, healing: 'lots', damage_blocked: 1e12, seconds: 99_999 })],
    }));

    assert.equal(upload, null);
  });

  it('keeps the segment when one figure is bad and another is good', () => {
    const upload = readExtendedUpload(match({}, {
      hero_segments: [segment({ damage_dealt: -5, healing: null, damage_blocked: undefined })],
    }));

    assert.deepEqual(upload?.hero_figures, [
      { hero_id: 1011, seconds: 300, damage_dealt: null, healing: null, damage_blocked: null },
    ]);
  });

  it('reads numeric strings, rounds fractions and refuses other types', () => {
    const upload = readExtendedUpload(match({}, {
      hero_segments: [segment({ seconds: '61.6', damage_dealt: 10.4, healing: true, damage_blocked: [3] })],
    }));

    assert.deepEqual(upload?.hero_figures, [
      { hero_id: 1011, seconds: 62, damage_dealt: 10, healing: null, damage_blocked: null },
    ]);
  });

  it('drops a segment with no usable hero id or no usable figure', () => {
    const upload = readExtendedUpload(match({}, {
      hero_segments: [
        segment({ hero_id: 0 }),
        segment({ hero_id: -4 }),
        segment({ hero_id: 'iron-man' }),
        segment({ hero_id: 2_147_483_648 }),
        segment({ hero_id: 1011.5 }),
        segment({ hero_id: 1033, seconds: null, damage_dealt: null, healing: null, damage_blocked: null }),
        'not a segment',
        null,
        segment({ hero_id: 1044 }),
      ],
    }));

    assert.deepEqual(upload?.hero_figures.map(figure => figure.hero_id), [1044]);
  });

  it('keeps the first segment of a hero listed twice', () => {
    const upload = readExtendedUpload(match({}, {
      hero_segments: [segment({ damage_dealt: 1 }), segment({ damage_dealt: 2 })],
    }));

    assert.deepEqual(upload?.hero_figures.map(figure => figure.damage_dealt), [1]);
  });

  it('keeps at most as many segments as a real match can have', () => {
    const segments = Array.from({ length: MAX_HERO_FIGURES + 5 }, (_, index) => segment({ hero_id: 1000 + index }));

    assert.equal(readExtendedUpload(match({}, { hero_segments: segments }))?.hero_figures.length, MAX_HERO_FIGURES);
  });

  it('ignores damage and healing on any roster line, which are never the recorder\'s own segments', () => {
    const upload = readExtendedUpload(match({
      match_players: [{ player_uid: '100', nick_name: 'Alpha', total_hero_damage: 9000, damage_blocked: 5, hero_segments: [segment()] }],
    }));

    assert.equal(upload, null);
  });

  it('stores no segments without the recorder uid, which is how they are tied to the match', () => {
    const upload = readExtendedUpload(match(
      { hero_kills: [{ killer: 'iron-man', victim: 'hulk', kills: 1 }] },
      { player_uid: undefined, hero_segments: [segment()] },
    ));

    assert.deepEqual(upload, {
      recorder_uid: null,
      hero_figures: [],
      hero_kills: [{ killer: 'iron-man', victim: 'hulk', kills: 1 }],
    });
  });

  it('ignores a hero_segments or hero_kills value that is not a list', () => {
    assert.equal(readExtendedUpload(match({ hero_kills: { killer: 'a', victim: 'b', kills: 1 } }, { hero_segments: 'x' })), null);
  });
});

describe('readExtendedUpload kill feed', () => {
  function feed(hero_kills: unknown): unknown {
    return readExtendedUpload(match({ hero_kills }))?.hero_kills;
  }

  it('lower-cases and trims the hero slugs', () => {
    assert.deepEqual(feed([{ killer: ' Iron-Man ', victim: 'THE-THING', kills: 2 }]), [
      { killer: 'iron-man', victim: 'the-thing', kills: 2 },
    ]);
  });

  it('keeps a hero killing its own kind', () => {
    assert.deepEqual(feed([{ killer: 'hulk', victim: 'hulk', kills: 1 }]), [{ killer: 'hulk', victim: 'hulk', kills: 1 }]);
  });

  it('drops an entry with a bad slug or a kill count that is not a positive whole number', () => {
    const entries = [
      { killer: 'iron man', victim: 'hulk', kills: 1 },
      { killer: 'iron-man', victim: '', kills: 1 },
      { killer: 'iron-man', victim: 'hulk>thor', kills: 1 },
      { killer: 'x'.repeat(41), victim: 'hulk', kills: 1 },
      { killer: 'iron-man', victim: 'hulk', kills: 0 },
      { killer: 'iron-man', victim: 'hulk', kills: -1 },
      { killer: 'iron-man', victim: 'hulk', kills: 1.5 },
      { killer: 'iron-man', victim: 'hulk', kills: MAX_KILLS_PER_PAIR + 1 },
      { killer: 'iron-man', victim: 'hulk', kills: 'many' },
      { killer: 7, victim: 'hulk', kills: 1 },
      null,
      'iron-man>hulk',
      { killer: 'thor', victim: 'loki', kills: '4' },
    ];

    assert.deepEqual(feed(entries), [{ killer: 'thor', victim: 'loki', kills: 4 }]);
  });

  it('adds up a pair listed twice, within the cap', () => {
    assert.deepEqual(
      feed([
        { killer: 'thor', victim: 'loki', kills: 2 },
        { killer: 'thor', victim: 'loki', kills: 3 },
        { killer: 'a', victim: 'b', kills: MAX_KILLS_PER_PAIR },
        { killer: 'a', victim: 'b', kills: 5 },
      ]),
      [
        { killer: 'thor', victim: 'loki', kills: 5 },
        { killer: 'a', victim: 'b', kills: MAX_KILLS_PER_PAIR },
      ],
    );
  });

  it('refuses a kill feed with more pairs than any lobby can produce', () => {
    const pairs = Array.from({ length: MAX_HERO_KILL_PAIRS + 1 }, (_, index) => ({
      killer: `hero-${index}`,
      victim: 'hulk',
      kills: 1,
    }));

    assert.equal(feed(pairs), undefined);
  });

  it('is null when no entry survives', () => {
    assert.equal(readExtendedUpload(match({ hero_kills: [{ killer: 'x y', victim: 'z', kills: 1 }] })), null);
  });
});

describe('a payload with the extended fields beside one without', () => {
  const old = (): JsonRecord => ({
    match_uid: 'local-1',
    match_time_stamp: 1_800_000_000,
    match_season: 10.5,
    play_mode_id: 1,
    match_map_name: 'Tokyo 2099',
    match_player: { player_uid: '100', camp: 0, is_win: true, kills: 5, deaths: 2, assists: 7 },
    match_players: [
      { player_uid: '100', nick_name: 'Alpha', camp: 0, cur_hero_id: 1011, kills: 5, deaths: 2, assists: 7 },
      { player_uid: '200', nick_name: 'Beta', camp: 1, cur_hero_id: 1022, kills: 1, deaths: 6, assists: 0 },
    ],
  });
  const extended = (): JsonRecord => ({
    ...old(),
    match_player: { ...(old().match_player as JsonRecord), hero_segments: [segment()] },
    hero_kills: [{ killer: 'iron-man', victim: 'hulk', kills: 3 }],
  });

  it('stores the same scoreboard, fingerprint, mode and history row either way', async () => {
    assert.deepEqual(parseParticipants(extended()), parseParticipants(old()));
    assert.equal(await rosterFingerprint(parseParticipants(extended())), await rosterFingerprint(parseParticipants(old())));
    assert.deepEqual(readMatchContext(extended()), readMatchContext(old()));
    assert.deepEqual(storableMatch(extended()), storableMatch(old()));
  });

  it('is read as extended only when the new fields are there', () => {
    assert.equal(readExtendedUpload(old()), null);
    assert.notEqual(readExtendedUpload(extended()), null);
  });
});
