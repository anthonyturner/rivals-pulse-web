import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { GameStatsResponse } from '../src/contracts/game-stats.model.ts';
import { runGameStatsCapture } from '../src/server/sync/game-stats-sync.ts';
import type { recordSyncRun } from '../src/server/sync/sync-log.ts';
import type { GameStatsCapture } from '../src/server/sync/game-stats-sync.ts';
import { reportGameStatsCapture } from './game-stats-report.ts';

function capture(overrides: Partial<GameStatsCapture> = {}, response: Partial<GameStatsResponse> = {}): GameStatsCapture {
  return {
    response: {
      snapshotDate: 'November 9, 2026',
      fetchedAt: '2026-11-09T10:15:00.000Z',
      currentPlayerSource: 'Valve',
      currentPlayerSourceUrl: 'https://example.test',
      snapshot: { id: 7, snapshotDate: 'November 9, 2026', capturedAt: '2026-11-09T10:15:00.000Z', persisted: true },
      games: [{}, {}] as GameStatsResponse['games'],
      ...response,
    },
    steamFallbacks: 0,
    alreadyCaptured: false,
    ...overrides,
  };
}

/** Runs the work and skips the sync log, so the capture touches no database. */
const passThrough: typeof recordSyncRun = (_client, _key, _start, work) => work();

describe('reportGameStatsCapture', () => {
  it('says a stored capture was stored, and is not a failure', () => {
    const report = reportGameStatsCapture(capture());

    assert.equal(report.failed, false);
    assert.match(report.lines[0], /^Captured 2 games; the hour's snapshot is 7/);
    assert.deepEqual(report.lines.slice(1), ['Games: 2', 'Compared with: first stored snapshot']);
  });

  it('names the earlier snapshot it was compared with', () => {
    const previousSnapshot = { id: 6, snapshotDate: 'November 8, 2026', capturedAt: '2026-11-08T10:00:00.000Z', persisted: true };
    const report = reportGameStatsCapture(capture({}, { previousSnapshot }));

    assert.equal(report.lines.at(-1), 'Compared with: November 8, 2026');
  });

  it('says nothing was stored when the hour already had its capture, without failing', () => {
    const report = reportGameStatsCapture(capture({ alreadyCaptured: true }));

    assert.equal(report.failed, false);
    assert.match(report.lines[0], /^Stored nothing: the hour's snapshot 7 was already captured at /);
  });

  it('says some games carry built-in numbers when Steam missed them', () => {
    const report = reportGameStatsCapture(capture({ steamFallbacks: 1 }));

    assert.equal(report.failed, false);
    assert.match(report.lines[0], /Steam did not answer for 1 of 2 games, so their built-in numbers were stored/);
  });

  it('fails, and never claims a save, when the store failed', () => {
    const report = reportGameStatsCapture(capture({ failure: 'Storing the game-stat snapshot failed: boom' }));

    assert.equal(report.failed, true);
    assert.equal(report.lines.length, 1);
    assert.match(report.lines[0], /Could not store the game stats .*: Storing the game-stat snapshot failed: boom/);
    assert.doesNotMatch(report.lines[0], /Saved|Captured/);
  });

  it('fails for a real capture when Steam answers for no game, without touching the database', async () => {
    const result = await runGameStatsCapture(
      {} as never,
      passThrough,
      { fetch: (async () => { throw new Error('offline'); }) as typeof fetch },
    );
    const report = reportGameStatsCapture(result);

    assert.equal(report.failed, true);
    assert.match(report.lines[0], /Steam did not answer for any of the 5 games, so nothing was stored/);
  });
});
