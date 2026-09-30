import { connect, type Connection } from '@tursodatabase/serverless';

import type {
  GameComparison,
  GameSnapshotComparison,
  GameStatsResponse,
  GameStatsSnapshotReference,
  MetricComparison,
  RankComparison,
  SnapshotTrend,
} from './contracts/game-stats.model.js';

const nodeProcess = process as typeof process & {
  loadEnvFile?: (path?: string) => void;
};

try {
  nodeProcess.loadEnvFile?.('.env');
} catch {
  // Environment variables may already be provided by the shell or deployment host.
}

interface SteamGameDefinition extends Omit<GameComparison, 'currentPlayers' | 'comparison'> {
  fallbackCurrentPlayers: number;
}

interface StoredSnapshotRow {
  id: number;
  snapshot_date: string;
  captured_at: string;
}

interface StoredGameRow {
  app_id: number;
  name: string;
  category: string;
  current_players: number;
  daily_peak: number;
  all_time_peak: number;
  steam_daily_rank: string;
  top_seller_rank: string;
  twitch_viewers: number;
  review_summary: string;
  source_url: string;
}

interface PersistedSnapshotContext {
  current: GameStatsSnapshotReference;
  previous?: GameStatsSnapshotReference;
  previousGames: Map<number, GameComparison>;
}

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

let client: Connection | undefined;
let schemaReady = false;

export async function syncGameStats(): Promise<GameStatsResponse> {
  const fetchedAt = new Date().toISOString();
  const snapshotDate = formatSnapshotDate(fetchedAt);
  const liveGames = await Promise.all(games.map(async (game) => {
    const { fallbackCurrentPlayers, ...metadata } = game;

    return {
      ...metadata,
      currentPlayers: await getCurrentPlayers(game.appId, fallbackCurrentPlayers),
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

  try {
    context = await persistSnapshot(snapshotDate, fetchedAt, liveGames);
  } catch (error) {
    console.error('Game stat snapshot persistence failed; serving live values without history', error);
  }

  return {
    snapshotDate,
    fetchedAt,
    currentPlayerSource: 'Valve ISteamUserStats GetNumberOfCurrentPlayers',
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
  snapshotDate: string,
  capturedAt: string,
  currentGames: GameComparison[],
): Promise<PersistedSnapshotContext> {
  await ensureGameStatsSchema();

  const captureBucket = toHourlyCaptureBucket(capturedAt);
  const previousRow = await queryOne<StoredSnapshotRow>(
    `SELECT id, snapshot_date, captured_at
    FROM game_stat_snapshots
    WHERE capture_bucket < ?
    ORDER BY capture_bucket DESC
    LIMIT 1`,
    captureBucket,
  );

  await execute(
    `INSERT OR IGNORE INTO game_stat_snapshots (
      capture_bucket, snapshot_date, captured_at, current_player_source, current_player_source_url
    ) VALUES (?, ?, ?, ?, ?)`,
    captureBucket,
    snapshotDate,
    capturedAt,
    'Valve ISteamUserStats GetNumberOfCurrentPlayers',
    steamCurrentPlayersUrl,
  );

  const currentRow = await queryOne<StoredSnapshotRow>(
    `SELECT id, snapshot_date, captured_at
    FROM game_stat_snapshots
    WHERE capture_bucket = ?`,
    captureBucket,
  );

  if (!currentRow) {
    throw new Error('Failed to load the saved game-stat snapshot');
  }

  const storedGameCount = await queryOne<{ count: number }>(
    'SELECT COUNT(*) AS count FROM game_stat_snapshot_games WHERE snapshot_id = ?',
    currentRow.id,
  );

  if (Number(storedGameCount?.count ?? 0) < currentGames.length) {
    await getClient().batch(currentGames.map((game) => ({
      sql: `INSERT OR IGNORE INTO game_stat_snapshot_games (
        snapshot_id, app_id, name, category, current_players, daily_peak, all_time_peak,
        steam_daily_rank, top_seller_rank, twitch_viewers, review_summary, source_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        currentRow.id,
        game.appId,
        game.name,
        game.category,
        game.currentPlayers,
        game.dailyPeak,
        game.allTimePeak,
        game.steamDailyRank,
        game.topSellerRank,
        game.twitchViewers,
        game.reviewSummary,
        game.sourceUrl,
      ],
    })), 'immediate');
  }

  const previousGames = previousRow
    ? await getStoredGames(previousRow.id)
    : new Map<number, GameComparison>();

  return {
    current: toSnapshotReference(currentRow),
    previous: previousRow ? toSnapshotReference(previousRow) : undefined,
    previousGames,
  };
}

async function getStoredGames(snapshotId: number): Promise<Map<number, GameComparison>> {
  const rows = await queryRows<StoredGameRow>(
    `SELECT app_id, name, category, current_players, daily_peak, all_time_peak,
      steam_daily_rank, top_seller_rank, twitch_viewers, review_summary, source_url
    FROM game_stat_snapshot_games
    WHERE snapshot_id = ?`,
    snapshotId,
  );

  return new Map(rows.map((row) => [Number(row.app_id), {
    appId: Number(row.app_id),
    name: row.name,
    category: row.category,
    currentPlayers: Number(row.current_players),
    dailyPeak: Number(row.daily_peak),
    allTimePeak: Number(row.all_time_peak),
    steamDailyRank: row.steam_daily_rank,
    topSellerRank: row.top_seller_rank,
    twitchViewers: Number(row.twitch_viewers),
    reviewSummary: row.review_summary,
    sourceUrl: row.source_url,
  }]));
}

async function ensureGameStatsSchema(): Promise<void> {
  if (schemaReady) {
    return;
  }

  const statements = [
    `CREATE TABLE IF NOT EXISTS game_stat_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      capture_bucket TEXT NOT NULL UNIQUE,
      snapshot_date TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      current_player_source TEXT NOT NULL,
      current_player_source_url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS game_stat_snapshot_games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      snapshot_id INTEGER NOT NULL REFERENCES game_stat_snapshots(id) ON DELETE CASCADE,
      app_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      current_players INTEGER NOT NULL,
      daily_peak INTEGER NOT NULL,
      all_time_peak INTEGER NOT NULL,
      steam_daily_rank TEXT NOT NULL,
      top_seller_rank TEXT NOT NULL,
      twitch_viewers INTEGER NOT NULL,
      review_summary TEXT NOT NULL,
      source_url TEXT NOT NULL,
      UNIQUE (snapshot_id, app_id)
    )`,
    'CREATE INDEX IF NOT EXISTS idx_game_stat_snapshots_captured_at ON game_stat_snapshots(captured_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_game_stat_snapshot_games_app ON game_stat_snapshot_games(app_id, snapshot_id)',
  ];

  for (const statement of statements) {
    await execute(statement);
  }

  schemaReady = true;
}

async function getCurrentPlayers(appId: number, fallback: number): Promise<number> {
  try {
    const response = await fetch(`${steamCurrentPlayersUrl}?appid=${appId}`, {
      headers: {
        accept: 'application/json',
        'user-agent': 'rivals-pulse-game-stats/2.0',
      },
    });

    if (!response.ok) {
      return fallback;
    }

    const payload = await response.json() as {
      response?: {
        player_count?: number;
      };
    };

    return payload.response?.player_count ?? fallback;
  } catch {
    return fallback;
  }
}

async function queryRows<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  const result = await getClient().execute(sql, params);

  return result.rows as unknown as T[];
}

async function queryOne<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
  return (await queryRows<T>(sql, ...params))[0];
}

async function execute(sql: string, ...params: unknown[]): Promise<void> {
  await getClient().execute(sql, params);
}

function getClient(): Connection {
  if (client) {
    return client;
  }

  const url = process.env['TURSO_DATABASE_URL'];
  const authToken = process.env['TURSO_AUTH_TOKEN'];

  if (!url || !authToken) {
    throw new Error('Turso is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
  }

  client = connect({ url, authToken });

  return client;
}

function toSnapshotReference(row: StoredSnapshotRow): GameStatsSnapshotReference {
  return {
    id: Number(row.id),
    snapshotDate: row.snapshot_date,
    capturedAt: row.captured_at,
    persisted: true,
  };
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
