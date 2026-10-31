import type { GameComparison } from './contracts/game-stats.model';
import { fakeSupabaseClient, type FakeResponse, type RecordedCall } from './fake-supabase-client';
import {
  GAME_STATS_SYNC_KEY,
  countGameStatSnapshotGames,
  countGameStatSnapshots,
  gameStatsRunResult,
  runGameStatsSync,
  syncGameStats,
} from './game-stats-sync';
import type { recordSyncRun, SyncRunResult } from './sync-log';

const NOW = new Date('2026-10-31T12:10:03.279Z');
const MARVEL_RIVALS = 2767030;

/** Steam answers every app with `players`, or fails when it is undefined. */
function steam(players?: number): typeof fetch {
  return (async () => {
    if (players === undefined) {
      throw new Error('offline');
    }

    return { ok: true, json: async () => ({ response: { player_count: players } }) };
  }) as unknown as typeof fetch;
}

function storedGame(overrides: Partial<GameComparison> = {}): GameComparison {
  return {
    appId: MARVEL_RIVALS,
    name: 'Marvel Rivals',
    category: 'Hero shooter',
    currentPlayers: 50000,
    dailyPeak: 118674,
    allTimePeak: 644269,
    steamDailyRank: '#16',
    topSellerRank: '#4',
    twitchViewers: 24451,
    reviewSummary: 'Mostly Positive, 75.74% SteamDB rating, 394k reviews',
    sourceUrl: 'https://steamdb.info/app/2767030/charts/',
    ...overrides,
  };
}

function rpcAnswer(previous: unknown): FakeResponse {
  return {
    data: {
      current: { id: 2218, snapshotDate: 'October 31, 2026', capturedAt: '2026-10-31T12:10:03.279+00:00' },
      previous,
    },
  };
}

const previousSnapshot = {
  id: 2217,
  snapshotDate: 'October 31, 2026',
  capturedAt: '2026-10-31T11:10:03.258+00:00',
  games: [storedGame()],
};

function rpcArgs(calls: RecordedCall[]): Record<string, unknown> {
  const [name, args] = calls[0].steps[0][1] as [string, Record<string, unknown>];

  expect(name).toBe('record_game_stat_snapshot');

  return args;
}

describe('syncGameStats', () => {
  it('stores the capture under its UTC hour with the live games', async () => {
    const { client, calls } = fakeSupabaseClient(() => rpcAnswer(previousSnapshot));

    await syncGameStats(client, { fetch: steam(60000), now: () => NOW });

    const args = rpcArgs(calls);
    expect(args['p_capture_bucket']).toBe('2026-10-31T12:00:00.000Z');
    expect(args['p_captured_at']).toBe('2026-10-31T12:10:03.279Z');
    expect(args['p_snapshot_date']).toBe('October 31, 2026');
    expect(args['p_current_player_source']).toBe('Valve ISteamUserStats GetNumberOfCurrentPlayers');
    expect(args['p_games']).toContain(
      jasmine.objectContaining({ appId: MARVEL_RIVALS, currentPlayers: 60000, steamDailyRank: '#15' }),
    );
    expect((args['p_games'] as unknown[]).length).toBe(5);
  });

  it('returns the stored capture and compares each game with the capture before it', async () => {
    const { client } = fakeSupabaseClient(() => rpcAnswer(previousSnapshot));

    const response = await syncGameStats(client, { fetch: steam(60000), now: () => NOW });

    expect(response.snapshot).toEqual({
      id: 2218,
      snapshotDate: 'October 31, 2026',
      capturedAt: '2026-10-31T12:10:03.279Z',
      persisted: true,
    });
    expect(response.previousSnapshot).toEqual({
      id: 2217,
      snapshotDate: 'October 31, 2026',
      capturedAt: '2026-10-31T11:10:03.258Z',
      persisted: true,
    });

    const rivals = response.games.find((game) => game.appId === MARVEL_RIVALS)!;
    expect(rivals.currentPlayers).toBe(60000);
    expect(rivals.comparison).toEqual(
      jasmine.objectContaining({
        previousCapturedAt: '2026-10-31T11:10:03.258Z',
        currentPlayers: { previous: 50000, change: 10000, changePercent: 20, trend: 'up' },
        steamDailyRank: { previous: '#16', positionsChanged: 1, trend: 'up' },
      }),
    );
    expect(response.games.find((game) => game.appId === 730)!.comparison).toBeUndefined();
  });

  it('has nothing to compare with on the first capture', async () => {
    const { client } = fakeSupabaseClient(() => rpcAnswer(null));

    const response = await syncGameStats(client, { fetch: steam(60000), now: () => NOW });

    expect(response.snapshot.persisted).toBeTrue();
    expect(response.previousSnapshot).toBeUndefined();
    expect(response.games.every((game) => game.comparison === undefined)).toBeTrue();
  });

  it('serves the live values unstored when the database refuses the capture', async () => {
    spyOn(console, 'error');
    const { client } = fakeSupabaseClient(() => ({ error: { message: 'boom' } }));

    const response = await syncGameStats(client, { fetch: steam(60000), now: () => NOW });

    expect(response.snapshot).toEqual({
      snapshotDate: 'October 31, 2026',
      capturedAt: '2026-10-31T12:10:03.279Z',
      persisted: false,
    });
    expect(response.games.length).toBe(5);
    expect(response.games.every((game) => game.comparison === undefined)).toBeTrue();
    expect(console.error).toHaveBeenCalled();
  });

  it('treats an answer of the wrong shape as unstored', async () => {
    spyOn(console, 'error');
    const { client } = fakeSupabaseClient(() =>
      rpcAnswer({ ...previousSnapshot, games: [{ ...storedGame(), currentPlayers: '50000' }] }),
    );

    const response = await syncGameStats(client, { fetch: steam(60000), now: () => NOW });

    expect(response.snapshot.persisted).toBeFalse();
  });

  it('falls back to the built-in player count when Steam cannot be reached', async () => {
    const { client } = fakeSupabaseClient(() => rpcAnswer(null));

    const response = await syncGameStats(client, { fetch: steam(undefined), now: () => NOW });

    expect(response.games.find((game) => game.appId === MARVEL_RIVALS)!.currentPlayers).toBe(59562);
  });
});

describe('runGameStatsSync', () => {
  /** A stand-in for recordSyncRun that keeps the run result it was asked to record. */
  function recorder() {
    const recorded: SyncRunResult[] = [];
    const record = jasmine
      .createSpy('recordSyncRun')
      .and.callFake(async (_client, _key, _message, work: () => Promise<unknown>, describe) => {
        const value = await work();
        recorded.push(describe(value));

        return value;
      });

    return { record: record as unknown as typeof recordSyncRun, spy: record, recorded };
  }

  it('records a stored capture as a successful game-stats run', async () => {
    const { client } = fakeSupabaseClient(() => rpcAnswer(previousSnapshot));
    const { record, spy, recorded } = recorder();

    const response = await runGameStatsSync(client, record, { fetch: steam(60000), now: () => NOW });

    expect(spy).toHaveBeenCalledWith(client, 'game-stats', jasmine.any(String), jasmine.any(Function), gameStatsRunResult);
    expect(GAME_STATS_SYNC_KEY).toBe('game-stats');
    expect(response.snapshot.persisted).toBeTrue();
    expect(recorded).toEqual([
      {
        status: 'success',
        message: "Captured 5 games; the hour's snapshot is 2218 (2026-10-31T12:10:03.279Z)",
        details: { snapshotId: 2218, previousSnapshotId: 2217 },
      },
    ]);
  });

  it('records a capture that could not be stored as a failed run, with the reason', async () => {
    spyOn(console, 'error');
    const { client } = fakeSupabaseClient(() => ({ error: { message: 'boom' } }));
    const { record, recorded } = recorder();

    const response = await runGameStatsSync(client, record, { fetch: steam(60000), now: () => NOW });

    expect(response.snapshot.persisted).toBeFalse();
    expect(recorded).toEqual([
      {
        status: 'error',
        message:
          'Could not store the game stats captured at 2026-10-31T12:10:03.279Z: ' +
          'Storing the game-stat snapshot failed: boom',
      },
    ]);
  });
});

describe('game stat counts', () => {
  it('counts each table without reading its rows', async () => {
    const { client, calls } = fakeSupabaseClient((call) => ({
      count: call.table === 'game_stat_snapshots' ? 2203 : 11015,
    }));

    expect(await countGameStatSnapshots(client)).toBe(2203);
    expect(await countGameStatSnapshotGames(client)).toBe(11015);
    expect(calls[1].table).toBe('game_stat_snapshot_games');
    expect(calls[0].steps).toEqual([['select', ['*', { count: 'exact', head: true }]]]);
  });

  it('names the table when counting fails', async () => {
    const { client } = fakeSupabaseClient(() => ({ error: { message: 'boom' } }));

    await expectAsync(countGameStatSnapshots(client)).toBeRejectedWithError(
      'Counting game_stat_snapshots failed: boom',
    );
  });
});
