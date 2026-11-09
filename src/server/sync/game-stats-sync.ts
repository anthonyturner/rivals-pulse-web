import type { SupabaseClient } from '@supabase/supabase-js';

import type { GameStatsOutcome } from '../../contracts/admin-data-jobs.model.ts';
import type {
  GameComparison,
  GameSnapshotComparison,
  GameStatsResponse,
  GameStatsSnapshotReference,
  MetricComparison,
  RankComparison,
  SnapshotTrend,
} from '../../contracts/game-stats.model.ts';
import type { recordSyncRun, SyncRunResult } from './sync-log.ts';

// The one place that knows how game stats are captured and stored in Supabase, shared by the API,
// the hourly sync and `npm run sync:game-stats`. No relative runtime import, for the same reason as
// hero-store.ts.

/** The `sync_runs.source_key` of the hourly sync. */
export const GAME_STATS_SYNC_KEY = 'game-stats';

interface GameStatsSyncOptions {
  /** Reaches Steam; a test passes a stand-in. */
  fetch?: typeof fetch;
  /** How long one Steam read may take before it counts as unanswered. */
  steamTimeoutMs?: number;
  now?: () => Date;
  /** Marks the `sync_runs` row as an administrator's run. */
  byAdmin?: boolean;
}

interface SteamGameDefinition extends Omit<GameComparison, 'currentPlayers' | 'comparison'> {
  fallbackCurrentPlayers: number;
}

/**
 * A capture, and why it was not stored when it was not (`failure`). An hour that already has a
 * capture keeps it: the numbers read this time are returned but not stored (`alreadyCaptured`). A
 * game Steam did not answer for carries its built-in number, and `steamFallbacks` counts them; when
 * Steam answers for none, the built-in numbers are returned but never stored.
 */
export interface GameStatsCapture {
  response: GameStatsResponse;
  failure?: string;
  steamFallbacks: number;
  alreadyCaptured: boolean;
}

interface PersistedSnapshotContext {
  current: GameStatsSnapshotReference;
  previous?: GameStatsSnapshotReference;
  previousGames: Map<number, GameComparison>;
}

const SNAPSHOT_TABLE = 'game_stat_snapshots';
const SNAPSHOT_GAME_TABLE = 'game_stat_snapshot_games';
const RECORD_FUNCTION = 'record_game_stat_snapshot';
/** Well inside the 60-second function limit, with room for the five reads to run side by side. */
const STEAM_READ_TIMEOUT_MS = 5000;
const currentPlayerSource = 'Valve ISteamUserStats GetNumberOfCurrentPlayers';
const steamCurrentPlayersUrl =
  'https://api.steampowered.com/ISteamUserStats/GetNumberOfCurrentPlayers/v1/';

const games: SteamGameDefinition[] = [
  {
    appId: 2767030,
    name: 'Marvel Rivals',
    category: 'Hero shooter',
    fallbackCurrentPlayers: 59562,
    dailyPeak: 118674,
    allTimePeak: 644269,
    steamDailyRank: '#15',
    topSellerRank: '#4',
    twitchViewers: 24451,
    reviewSummary: 'Mostly Positive, 75.74% SteamDB rating, 394k reviews',
    sourceUrl: 'https://steamdb.info/app/2767030/charts/',
  },
  {
    appId: 2357570,
    name: 'Overwatch',
    category: 'Hero shooter',
    fallbackCurrentPlayers: 56818,
    dailyPeak: 81755,
    allTimePeak: 165651,
    steamDailyRank: '#14',
    topSellerRank: '#19',
    twitchViewers: 34794,
    reviewSummary: 'Mostly Negative, 30.94% SteamDB rating, 407k reviews',
    sourceUrl: 'https://steamdb.info/app/2357570/charts/',
  },
  {
    appId: 1172470,
    name: 'Apex Legends',
    category: 'Battle royale shooter',
    fallbackCurrentPlayers: 121009,
    dailyPeak: 194956,
    allTimePeak: 624473,
    steamDailyRank: '#8',
    topSellerRank: '#18',
    twitchViewers: 13672,
    reviewSummary: 'Mixed, 67.41% SteamDB rating, 1.05M reviews',
    sourceUrl: 'https://steamdb.info/app/1172470/charts/',
  },
  {
    appId: 570,
    name: 'Dota 2',
    category: 'MOBA',
    fallbackCurrentPlayers: 382833,
    dailyPeak: 609443,
    allTimePeak: 1295114,
    steamDailyRank: '#2',
    topSellerRank: '#40',
    twitchViewers: 39955,
    reviewSummary: 'Very Positive, 80.38% SteamDB rating, 2.72M reviews',
    sourceUrl: 'https://steamdb.info/app/570/charts/',
  },
  {
    appId: 730,
    name: 'Counter-Strike 2',
    category: 'Tactical shooter',
    fallbackCurrentPlayers: 854652,
    dailyPeak: 1374512,
    allTimePeak: 1862531,
    steamDailyRank: '#1',
    topSellerRank: '#3',
    twitchViewers: 0,
    reviewSummary: 'Very Positive, 85.83% SteamDB rating, 9.67M reviews',
    sourceUrl: 'https://steamdb.info/app/730/charts/',
  },
];

/**
 * Reads the current Steam player counts, stores them as this hour's capture unless the hour already
 * has one, and compares them with the capture before it. When storing fails, or Steam answers for
 * no game at all, the values are still returned, with `snapshot.persisted` false and no comparison.
 */
export async function syncGameStats(
  client: SupabaseClient,
  options: GameStatsSyncOptions = {},
): Promise<GameStatsResponse> {
  return (await captureGameStats(client, options)).response;
}

/**
 * The hourly sync: one capture, recorded in `sync_runs` under `game-stats`. `record` is
 * sync-log's `recordSyncRun`, passed in because this module has no relative runtime import.
 */
export async function runGameStatsSync(
  client: SupabaseClient,
  record: typeof recordSyncRun,
  options: GameStatsSyncOptions = {},
): Promise<GameStatsResponse> {
  return (await runGameStatsCapture(client, record, options)).response;
}

/** `runGameStatsSync` with everything the capture learned, so a caller can say what really happened. */
export function runGameStatsCapture(
  client: SupabaseClient,
  record: typeof recordSyncRun,
  options: GameStatsSyncOptions = {},
): Promise<GameStatsCapture> {
  return record(
    client,
    GAME_STATS_SYNC_KEY,
    'Capturing the hourly game stats',
    () => captureGameStats(client, options),
    gameStatsRunResult,
    { byAdmin: options.byAdmin },
  );
}

/**
 * How a sync run is recorded: a capture that was not stored is a failed run. A run that stored
 * nothing because the hour already had a capture, or stored some built-in numbers because Steam did
 * not answer for every game, is still a success, but its message says so rather than claiming a
 * clean capture.
 */
export function gameStatsRunResult(capture: GameStatsCapture): SyncRunResult {
  const { response, failure, steamFallbacks } = capture;
  const { snapshot } = response;

  if (failure !== undefined) {
    return {
      status: 'error',
      message: `Could not store the game stats captured at ${response.fetchedAt}: ${failure}`,
    };
  }

  const outcome = describeGameStatsCapture(capture);
  const stored = outcome.result !== 'already-captured';
  const captured = stored
    ? `Captured ${response.games.length} games; the hour's snapshot is ${snapshot.id} (${snapshot.capturedAt})`
    : `Stored nothing: the hour's snapshot ${snapshot.id} was already captured at ${snapshot.capturedAt}`;
  const steamNote = steamFallbacks > 0
    ? `; Steam did not answer for ${steamFallbacks} of ${response.games.length} games${stored ? ', so their built-in numbers were stored' : ''}`
    : '';

  return {
    status: 'success',
    message: `${captured}${steamNote}`,
    details: {
      snapshotId: snapshot.id,
      previousSnapshotId: response.previousSnapshot?.id ?? null,
      result: outcome.result,
      steamFallbacks,
    },
  };
}

/**
 * What a capture that was stored came to, for the admin page. A capture that was not stored is a
 * failure with `failure` as its message, so it has no outcome here.
 */
export function describeGameStatsCapture({ response, steamFallbacks, alreadyCaptured }: GameStatsCapture): GameStatsOutcome {
  const games = response.games.length;
  const capturedAt = response.snapshot.capturedAt;

  if (alreadyCaptured) {
    return { result: 'already-captured', capturedAt, games, fallbackGames: steamFallbacks };
  }

  return steamFallbacks > 0
    ? { result: 'stored-with-fallbacks', capturedAt, games, fallbackGames: steamFallbacks }
    : { result: 'stored', capturedAt, games };
}

export async function countGameStatSnapshots(client: SupabaseClient): Promise<number> {
  return countRows(client, SNAPSHOT_TABLE);
}

export async function countGameStatSnapshotGames(client: SupabaseClient): Promise<number> {
  return countRows(client, SNAPSHOT_GAME_TABLE);
}

async function captureGameStats(
  client: SupabaseClient,
  options: GameStatsSyncOptions,
): Promise<GameStatsCapture> {
  const fetcher = options.fetch ?? fetch;
  const timeoutMs = options.steamTimeoutMs ?? STEAM_READ_TIMEOUT_MS;
  const fetchedAt = (options.now?.() ?? new Date()).toISOString();
  const snapshotDate = formatSnapshotDate(fetchedAt);
  let steamFallbacks = 0;
  const liveGames = await Promise.all(games.map(async (game) => {
    const { fallbackCurrentPlayers, ...metadata } = game;
    const reading = await getCurrentPlayers(fetcher, game.appId, timeoutMs);

    if (reading === undefined) {
      steamFallbacks += 1;
    }

    return {
      ...metadata,
      currentPlayers: reading ?? fallbackCurrentPlayers,
    } satisfies GameComparison;
  }));

  let context: PersistedSnapshotContext = {
    current: {
      snapshotDate,
      capturedAt: fetchedAt,
      persisted: false,
    },
    previousGames: new Map(),
  };

  let failure: string | undefined;

  // The hour's first capture wins, so built-in numbers stored during an outage would hide the real
  // ones for the rest of the hour. Store nothing, and a later run can.
  if (steamFallbacks === games.length) {
    failure = `Steam did not answer for any of the ${games.length} games, so nothing was stored`;
  } else {
    try {
      context = await persistSnapshot(client, snapshotDate, fetchedAt, liveGames);
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
      console.error('Game stat snapshot persistence failed; serving live values without history', error);
    }
  }

  const response: GameStatsResponse = {
    snapshotDate,
    fetchedAt,
    currentPlayerSource,
    currentPlayerSourceUrl: steamCurrentPlayersUrl,
    snapshot: context.current,
    previousSnapshot: context.previous,
    games: liveGames.map((game) => ({
      ...game,
      comparison: buildSnapshotComparison(
        game,
        context.previousGames.get(game.appId),
        context.previous?.capturedAt,
      ),
    })),
  };

  // The function answers with the hour's existing row when it has one, which carries the time that
  // capture was made rather than this one's.
  const alreadyCaptured = context.current.persisted && context.current.capturedAt !== fetchedAt;

  return { response, failure, steamFallbacks, alreadyCaptured };
}

export function buildSnapshotComparison(
  current: GameComparison,
  previous: GameComparison | undefined,
  previousCapturedAt: string | undefined,
): GameSnapshotComparison | undefined {
  if (!previous || !previousCapturedAt) {
    return undefined;
  }

  const comparison: GameSnapshotComparison = {
    previousCapturedAt,
    currentPlayers: compareMetric(current.currentPlayers, previous.currentPlayers),
    dailyPeak: compareMetric(current.dailyPeak, previous.dailyPeak),
    allTimePeak: compareMetric(current.allTimePeak, previous.allTimePeak),
    steamDailyRank: compareRank(current.steamDailyRank, previous.steamDailyRank),
    topSellerRank: compareRank(current.topSellerRank, previous.topSellerRank),
    read: '',
  };

  comparison.read = buildComparisonRead(comparison);

  return comparison;
}

function compareMetric(current: number, previous: number): MetricComparison {
  const change = current - previous;

  return {
    previous,
    change,
    changePercent: previous === 0 ? undefined : round((change / previous) * 100, 2),
    trend: toTrend(change),
  };
}

function compareRank(current: string, previous: string): RankComparison {
  const currentPosition = parseRank(current);
  const previousPosition = parseRank(previous);
  const positionsChanged = currentPosition !== undefined && previousPosition !== undefined
    ? previousPosition - currentPosition
    : undefined;

  return {
    previous,
    positionsChanged,
    trend: positionsChanged === undefined ? 'flat' : toTrend(positionsChanged),
  };
}

function buildComparisonRead(comparison: GameSnapshotComparison): string {
  const playerRead = describeMetric('Current players', comparison.currentPlayers);
  const dailyRead = describeMetric('the 24h peak', comparison.dailyPeak);
  const allTimeRead = describeMetric('the all-time peak', comparison.allTimePeak);
  const rankRead = describeRanks(comparison.steamDailyRank, comparison.topSellerRank);

  return `${playerRead}; ${dailyRead}; ${allTimeRead}. ${rankRead}`;
}

function describeMetric(label: string, comparison: MetricComparison): string {
  if (comparison.change === 0) {
    return `${label} is unchanged`;
  }

  const direction = comparison.change > 0 ? 'rose' : 'fell';
  const percent = comparison.changePercent === undefined
    ? ''
    : ` (${Math.abs(comparison.changePercent).toFixed(2)}%)`;

  return `${label} ${direction} by ${formatNumber(Math.abs(comparison.change))}${percent}`;
}

function describeRanks(dailyRank: RankComparison, sellerRank: RankComparison): string {
  const daily = describeRank('Daily rank', dailyRank);
  const seller = describeRank('seller rank', sellerRank);

  return `${daily}; ${seller}.`;
}

function describeRank(label: string, comparison: RankComparison): string {
  if (!comparison.positionsChanged) {
    return `${label} is unchanged`;
  }

  const direction = comparison.positionsChanged > 0 ? 'improved' : 'slipped';
  const positions = Math.abs(comparison.positionsChanged);

  return `${label} ${direction} by ${positions} ${positions === 1 ? 'place' : 'places'}`;
}

async function persistSnapshot(
  client: SupabaseClient,
  snapshotDate: string,
  capturedAt: string,
  currentGames: GameComparison[],
): Promise<PersistedSnapshotContext> {
  const { data, error } = await client.rpc(RECORD_FUNCTION, {
    p_capture_bucket: toHourlyCaptureBucket(capturedAt),
    p_snapshot_date: snapshotDate,
    p_captured_at: capturedAt,
    p_current_player_source: currentPlayerSource,
    p_current_player_source_url: steamCurrentPlayersUrl,
    p_games: currentGames,
  });

  if (error) {
    throw new Error(`Storing the game-stat snapshot failed: ${error.message}`);
  }

  const answer = recordOf(data, 'the answer');
  const previous = answer['previous'] === null ? undefined : recordOf(answer['previous'], 'previous');

  return {
    current: toSnapshotReference(recordOf(answer['current'], 'current')),
    previous: previous ? toSnapshotReference(previous) : undefined,
    previousGames: new Map(
      listOf(previous?.['games'] ?? [], 'previous.games').map((row) => {
        const game = toGameComparison(recordOf(row, 'a previous game'));

        return [game.appId, game];
      }),
    ),
  };
}

async function countRows(client: SupabaseClient, table: string): Promise<number> {
  const { count, error } = await client.from(table).select('*', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Counting ${table} failed: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * The player count Steam reports, or undefined when Steam did not give one. A read that outlasts
 * `timeoutMs` is one Steam did not give, so a hung call cannot hold the run to the function limit.
 */
async function getCurrentPlayers(
  fetcher: typeof fetch,
  appId: number,
  timeoutMs: number,
): Promise<number | undefined> {
  try {
    const response = await fetcher(`${steamCurrentPlayersUrl}?appid=${appId}`, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: 'application/json',
        'user-agent': 'rivals-pulse-game-stats/2.0',
      },
    });

    if (!response.ok) {
      return undefined;
    }

    const payload = await response.json() as {
      response?: {
        player_count?: number;
      };
    };

    return payload.response?.player_count;
  } catch {
    return undefined;
  }
}

function toSnapshotReference(row: Record<string, unknown>): GameStatsSnapshotReference {
  return {
    id: numberOf(row, 'id'),
    snapshotDate: stringOf(row, 'snapshotDate'),
    capturedAt: instantOf(row, 'capturedAt'),
    persisted: true,
  };
}

function toGameComparison(row: Record<string, unknown>): GameComparison {
  return {
    appId: numberOf(row, 'appId'),
    name: stringOf(row, 'name'),
    category: stringOf(row, 'category'),
    currentPlayers: numberOf(row, 'currentPlayers'),
    dailyPeak: numberOf(row, 'dailyPeak'),
    allTimePeak: numberOf(row, 'allTimePeak'),
    steamDailyRank: stringOf(row, 'steamDailyRank'),
    topSellerRank: stringOf(row, 'topSellerRank'),
    twitchViewers: numberOf(row, 'twitchViewers'),
    reviewSummary: stringOf(row, 'reviewSummary'),
    sourceUrl: stringOf(row, 'sourceUrl'),
  };
}

// Readers for the function's answer: a changed answer fails the capture instead of serving NaN.
function recordOf(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${RECORD_FUNCTION}: ${what} is not an object`);
  }

  return value as Record<string, unknown>;
}

function listOf(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${RECORD_FUNCTION}: ${what} is not a list`);
  }

  return value;
}

function numberOf(row: Record<string, unknown>, key: string): number {
  const value = row[key];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${RECORD_FUNCTION}: ${key} is not a number`);
  }

  return value;
}

function stringOf(row: Record<string, unknown>, key: string): string {
  const value = row[key];

  if (typeof value !== 'string') {
    throw new Error(`${RECORD_FUNCTION}: ${key} is not a string`);
  }

  return value;
}

// Postgres writes a timestamptz as `2026-10-31T00:10:03.279+00:00`; the API has always returned
// the `toISOString()` form.
function instantOf(row: Record<string, unknown>, key: string): string {
  const time = Date.parse(stringOf(row, key));

  if (Number.isNaN(time)) {
    throw new Error(`${RECORD_FUNCTION}: ${key} is not a timestamp`);
  }

  return new Date(time).toISOString();
}

function toHourlyCaptureBucket(value: string): string {
  const date = new Date(value);
  date.setUTCMinutes(0, 0, 0);

  return date.toISOString();
}

function formatSnapshotDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date(value));
}

function parseRank(value: string): number | undefined {
  const parsed = Number(value.replace(/[^0-9]/g, ''));

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function toTrend(change: number): SnapshotTrend {
  return change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;

  return Math.round(value * factor) / factor;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}
