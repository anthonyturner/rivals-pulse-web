import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseParticipants, type JsonRecord } from '../supabase/functions/track-match-history/match-payload.ts';
import {
  BACKFILL_RECORDER,
  planReplay,
  placeInHalfSeason,
  prepareRecorderLine,
  prepareReplay,
  rebuildUploadedMatch,
  replayStatement,
  type ExistingLine,
  type HalfSeasonStart,
  type ReplayMatch,
  type TrackedMatchRow,
} from './participants-replay.ts';

const STARTS: HalfSeasonStart[] = [
  { half_season: 10, starts_at: '2026-09-11T09:00:00Z' },
  { half_season: 10.5, starts_at: '2026-10-09T09:00:00Z' },
];

/** Two teams of two, camp 1 and camp 2; the recorder is 'u1' on camp 1. All names are made up. */
function roster(): JsonRecord[] {
  return [
    { player_uid: 'u1', nick_name: 'Alpha', camp: 1, cur_hero_id: 1011, kills: 5, deaths: 2, assists: 7 },
    { player_uid: 'u2', nick_name: 'Beta', camp: 1, cur_hero_id: 1012, kills: 3, deaths: 4, assists: 1 },
    { player_uid: 'u3', nick_name: 'Gamma', camp: 2, cur_hero_id: 1013, kills: 8, deaths: 1, assists: 2 },
    { player_uid: 'u4', nick_name: 'Delta', camp: 2, cur_hero_id: 1014, kills: 0, deaths: 9, assists: 0 },
  ];
}

function trackedRow(overrides: Partial<TrackedMatchRow> = {}): TrackedMatchRow {
  return {
    id: 1,
    raw_payload: {
      match_uid: 'm-1',
      match_time_stamp: 1_790_000_000,
      play_mode_id: 1,
      match_map_name: 'Synthetic Map',
      match_players: roster(),
    },
    performance: { player_uid: 'u1', camp: 1, is_win: true, kills: 5, deaths: 2, assists: 7 },
    ...overrides,
  };
}

async function replayOf(row: TrackedMatchRow, beforeFirst: number | null = null): Promise<ReplayMatch> {
  const prepared = await prepareReplay(row, STARTS, beforeFirst);
  assert.ok('match' in prepared, 'the row should be replayable');
  return prepared.match;
}

describe('rebuildUploadedMatch', () => {
  it('rebuilds the recorder side from performance so a win on the recorder team is a win only for that team', () => {
    const rows = parseParticipants(rebuildUploadedMatch(trackedRow()));

    assert.deepEqual(rows.map(row => [row.uid, row.team, row.is_win]), [
      ['u1', 1, true],
      ['u2', 1, true],
      ['u3', 2, false],
      ['u4', 2, false],
    ]);
  });

  it('turns a recorded loss into a win for the other team', () => {
    const loss = trackedRow({ performance: { player_uid: 'u1', camp: 1, is_win: false } });

    const rows = parseParticipants(rebuildUploadedMatch(loss));

    assert.deepEqual(rows.map(row => row.is_win), [false, false, true, true]);
  });

  it('follows the recorder camp when the recorder was on the second team', () => {
    const recorderOnTwo = trackedRow({ performance: { player_uid: 'u3', camp: 2, is_win: true } });

    const rows = parseParticipants(rebuildUploadedMatch(recorderOnTwo));

    assert.deepEqual(rows.map(row => row.is_win), [false, false, true, true]);
  });

  it('leaves every result unknown when the row has no recorded result', () => {
    const rows = parseParticipants(rebuildUploadedMatch(trackedRow({ performance: { player_uid: 'u1', camp: 1 } })));

    assert.deepEqual(rows.map(row => row.is_win), [null, null, null, null]);
  });

  it('leaves every result unknown when the row has no performance at all', () => {
    const rows = parseParticipants(rebuildUploadedMatch(trackedRow({ performance: null })));

    assert.ok(rows.every(row => row.is_win === null));
  });
});

describe('prepareReplay', () => {
  it('reads the time from match_time_stamp, which the live path would refuse as too old', async () => {
    const match = await replayOf(trackedRow({ raw_payload: { ...trackedRow().raw_payload, match_time_stamp: 1_700_000_000 } }));

    assert.equal(match.playedAt, '2023-11-14T22:13:20.000Z');
  });

  it('carries the mode and map, and null for a row that has neither', async () => {
    const withBoth = await replayOf(trackedRow());
    const withNeither = await replayOf(trackedRow({
      raw_payload: { ...trackedRow().raw_payload, play_mode_id: undefined, match_map_name: undefined },
    }));

    assert.deepEqual([withBoth.playModeId, withBoth.mapName], [1, 'Synthetic Map']);
    assert.deepEqual([withNeither.playModeId, withNeither.mapName], [null, null]);
  });

  it('gives the same fingerprint however the roster was ordered', async () => {
    const reversed = trackedRow({ raw_payload: { ...trackedRow().raw_payload, match_players: roster().reverse() } });

    assert.equal((await replayOf(reversed)).fingerprint, (await replayOf(trackedRow())).fingerprint);
  });

  it('skips a row with no stored roster, and one whose roster names nobody', async () => {
    const noRoster = { ...trackedRow().raw_payload, match_players: undefined };
    const nobody = trackedRow({ raw_payload: { ...trackedRow().raw_payload, match_players: [{ is_bot: true }] } });

    assert.deepEqual(await prepareReplay(trackedRow({ raw_payload: noRoster }), STARTS, null), { skipped: 'no-roster' });
    assert.deepEqual(await prepareReplay(nobody, STARTS, null), { skipped: 'unreadable-roster' });
  });

  it('skips a row with no usable timestamp', async () => {
    const row = trackedRow({ raw_payload: { ...trackedRow().raw_payload, match_time_stamp: 'soon' } });

    assert.deepEqual(await prepareReplay(row, STARTS, null), { skipped: 'no-timestamp' });
  });

  it('checks the recorder line sits on the camp the row stored', async () => {
    const agrees = await replayOf(trackedRow());
    const disagrees = await replayOf(trackedRow({ performance: { player_uid: 'u1', camp: 2, is_win: true } }));
    const absent = await replayOf(trackedRow({ performance: { camp: 1, is_win: true } }));

    assert.deepEqual([agrees.recorderTeam, disagrees.recorderTeam, absent.recorderTeam], ['agrees', 'disagrees', 'not-checkable']);
  });
});

describe('prepareRecorderLine', () => {
  const noRoster = (overrides: Partial<TrackedMatchRow> = {}): TrackedMatchRow => trackedRow({
    raw_payload: { ...trackedRow().raw_payload, match_players: undefined },
    ...overrides,
  });

  function storedLine(overrides: Partial<ExistingLine> = {}): ExistingLine {
    return {
      fingerprint: 'stored-fingerprint',
      halfSeason: 10.5,
      playedAt: '2026-09-21T14:13:20.000Z',
      uid: 'u1',
      name: 'Alpha',
      isWin: true,
      playModeId: null,
      mapName: null,
      ...overrides,
    };
  }

  it('replays the recorder line under the fingerprint of the stored match they were in', async () => {
    const match = await prepareRecorderLine(noRoster(), [storedLine()]);

    assert.equal(match?.source, 'recorder-line');
    assert.equal(match?.fingerprint, 'stored-fingerprint');
    assert.equal(match?.halfSeason, 10.5);
    assert.deepEqual(match?.lines.map(line => [line.uid, line.team, line.is_win, line.kills]), [['u1', 1, true, 5]]);
    assert.deepEqual([match?.playModeId, match?.mapName], [1, 'Synthetic Map']);
  });

  it('plans it as a repeat that fills the blank mode and compares the result', async () => {
    const match = await prepareRecorderLine(noRoster(), [storedLine({ isWin: false })]);

    const [planned] = planReplay([match!], [storedLine({ isWin: false })], new Set());

    assert.deepEqual(
      [planned.outcome, planned.agreed, planned.disagreed, planned.modeOrMapFilled],
      ['repeat-existing', 0, 1, true],
    );
  });

  it('finds nothing when no stored match has the recorder within four minutes', async () => {
    const elsewhere = storedLine({ playedAt: '2026-09-21T14:19:00.000Z' });
    const otherPlayer = storedLine({ uid: 'u9' });

    assert.equal(await prepareRecorderLine(noRoster(), [elsewhere, otherPlayer]), null);
    assert.equal(await prepareRecorderLine(noRoster({ performance: null }), [storedLine()]), null);
  });
});

describe('placeInHalfSeason', () => {
  const raw = (extra: JsonRecord = {}): JsonRecord => ({ match_time_stamp: 1, ...extra });

  it('takes the season the upload named', () => {
    assert.equal(placeInHalfSeason(raw({ match_season: 10.5 }), '2026-09-12T00:00:00Z', STARTS, null), 10.5);
  });

  it('otherwise takes the latest half-season that had started', () => {
    assert.equal(placeInHalfSeason(raw(), '2026-09-12T00:00:00Z', STARTS, null), 10);
    assert.equal(placeInHalfSeason(raw(), '2026-10-09T09:00:00Z', STARTS, null), 10.5);
    assert.equal(placeInHalfSeason(raw(), '2026-10-30T00:00:00Z', STARTS, null), 10.5);
  });

  it('places a match older than every known start only where it was told to', () => {
    assert.equal(placeInHalfSeason(raw(), '2026-08-30T00:00:00Z', STARTS, null), null);
    assert.equal(placeInHalfSeason(raw(), '2026-08-30T00:00:00Z', STARTS, 9.5), 9.5);
  });
});

describe('planReplay', () => {
  async function matchAt(timestamp: number, halfSeason = 10.5): Promise<ReplayMatch> {
    const match = await replayOf(trackedRow({ raw_payload: { ...trackedRow().raw_payload, match_time_stamp: timestamp } }));
    return { ...match, halfSeason };
  }

  function stored(match: ReplayMatch, overrides: Partial<ExistingLine> = {}): ExistingLine[] {
    return match.lines.map(line => ({
      fingerprint: match.fingerprint,
      halfSeason: 10.5,
      playedAt: match.playedAt,
      uid: line.uid,
      name: line.name,
      isWin: line.is_win,
      playModeId: match.playModeId,
      mapName: match.mapName,
      ...overrides,
    }));
  }

  it('calls a match new when nothing is stored for its roster', async () => {
    const [planned] = planReplay([await matchAt(1_790_000_000)], [], new Set());

    assert.equal(planned.outcome, 'new');
  });

  it('calls a match a repeat when the same roster is stored within four minutes, either side', async () => {
    const match = await matchAt(1_790_000_000);
    const nearby = await matchAt(1_790_000_000 + 240);
    const apart = await matchAt(1_790_000_000 + 241);

    const outcomes = planReplay([nearby, apart], stored(match), new Set()).map(planned => planned.outcome);

    assert.deepEqual(outcomes, ['repeat-existing', 'new']);
  });

  it('calls a second upload of the same match within the run a repeat of the first', async () => {
    const first = await matchAt(1_790_000_000);
    const second = await matchAt(1_790_000_090);

    const outcomes = planReplay([first, second], [], new Set()).map(planned => planned.outcome);

    assert.deepEqual(outcomes, ['new', 'repeat-in-run']);
  });

  it('finds every match already stored on a second run, so it adds nothing', async () => {
    const matches = [await matchAt(1_790_000_000), await matchAt(1_790_100_000)];
    const firstRun = planReplay(matches, [], new Set());

    const secondRun = planReplay(matches, firstRun.flatMap(planned => stored(planned.match)), new Set());

    assert.deepEqual(firstRun.map(planned => planned.outcome), ['new', 'new']);
    assert.deepEqual(secondRun.map(planned => planned.outcome), ['repeat-existing', 'repeat-existing']);
  });

  it('counts agreement and disagreement on decided results only', async () => {
    const match = await matchAt(1_790_000_000);
    const flipped = stored(match).map(line => (line.uid === 'u3' ? { ...line, isWin: true } : line));

    const [planned] = planReplay([match], flipped, new Set());

    assert.deepEqual([planned.agreed, planned.disagreed, planned.resultsFilled], [3, 1, 0]);
  });

  it('counts a blank stored result as one this replay fills, not as a disagreement', async () => {
    const match = await matchAt(1_790_000_000);

    const [planned] = planReplay([match], stored(match, { isWin: null }), new Set());

    assert.deepEqual([planned.agreed, planned.disagreed, planned.resultsFilled], [0, 0, 4]);
  });

  it('flags a repeat whose stored mode or map was blank', async () => {
    const match = await matchAt(1_790_000_000);

    const filled = planReplay([match], stored(match, { playModeId: null }), new Set())[0];
    const alreadyKnown = planReplay([match], stored(match), new Set())[0];

    assert.deepEqual([filled.modeOrMapFilled, alreadyKnown.modeOrMapFilled], [true, false]);
  });

  it('pairs a stored line with no uid by its lower-cased name', async () => {
    const match = await matchAt(1_790_000_000);
    const nameOnly: ReplayMatch = { ...match, lines: match.lines.map(line => ({ ...line, uid: null, name: ` ${line.name?.toUpperCase()} ` })) };

    const [planned] = planReplay([nameOnly], stored(match, { isWin: false }).map(line => ({ ...line, uid: null })), new Set());

    assert.equal(planned.agreed + planned.disagreed, 4);
  });

  it('leaves a frozen half-season and an unplaced match alone', async () => {
    const frozen = await matchAt(1_790_000_000, 9.5);
    const unplaced = { ...(await matchAt(1_790_001_000)), halfSeason: null };

    const outcomes = planReplay([frozen, unplaced], [], new Set([9.5])).map(planned => planned.outcome);

    assert.deepEqual(outcomes, ['frozen', 'unplaced']);
  });
});

describe('replayStatement', () => {
  it('calls the recorder once per match with typed arguments, in order', async () => {
    const match = { ...(await replayOf(trackedRow())), halfSeason: 10.5 };
    const [planned] = planReplay([match], [], new Set());

    const sql = replayStatement([planned, { ...planned, match: { ...match, halfSeason: 10, playModeId: null, mapName: null } }]);

    assert.match(sql, /public\.record_match_participants\(/);
    assert.ok(sql.includes(`'${BACKFILL_RECORDER}'`));
    assert.ok(sql.includes(`'${match.fingerprint}', 10.5::numeric, '2026-09-21T14:13:20.000Z'::timestamptz`));
    assert.ok(sql.includes('1::smallint, \'Synthetic Map\'::text'));
    assert.ok(sql.includes('null::smallint, null::text'));
    assert.ok(sql.trimEnd().endsWith('order by v.i;'));
  });

  it('escapes quotes in a name or map so a stored value cannot end the literal', async () => {
    const match = await replayOf(trackedRow());
    const hostile: ReplayMatch = {
      ...match,
      mapName: "Map'); drop table participants; --",
      lines: match.lines.map(line => ({ ...line, name: "O'Brien" })),
    };
    const [planned] = planReplay([hostile], [], new Set());

    const sql = replayStatement([planned]);

    assert.ok(sql.includes("'Map''); drop table participants; --'::text"));
    assert.ok(sql.includes('"name":"O\'\'Brien"'));
  });
});
