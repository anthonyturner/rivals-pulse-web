import { createClient, type Client } from '@tursodatabase/serverless/compat';

import { GlossaryTerm } from './app/features/reference/glossary/glossary.model.js';
import { HomeContent, PortalCard } from './app/features/home/home-content.model.js';
import { Hero, HeroVideo } from './app/features/heroes/hero.model.js';
import { TierListResponse } from './contracts/tier-list.model.js';

const nodeProcess = process as typeof process & {
  loadEnvFile?: (path?: string) => void;
};

try {
  nodeProcess.loadEnvFile?.('.env');
} catch {
  // Environment variables may already be provided by the shell or deployment host.
}

type ContentStatus = {
  databaseProvider: 'turso';
  databaseUrl: string;
  configured: boolean;
  heroes: number;
  glossaryTerms: number;
  externalSources: number;
  heroVideos: number;
  homePortals: number;
  homeContentBlocks: number;
  tierListSeasons: number;
  tierListItems: number;
  gameStatSnapshots: number;
  gameStatSnapshotGames: number;
};

let client: Client | undefined;

export async function getHeroesFromDatabase(): Promise<Hero[]> {
  return queryRows<{ raw_json: string }>(
    'SELECT raw_json FROM heroes ORDER BY name COLLATE NOCASE',
  ).then((rows) => rows.map((row) => JSON.parse(row.raw_json) as Hero));
}

export async function getHeroFromDatabase(id: string): Promise<Hero | undefined> {
  const row = await queryOne<{ raw_json: string }>(
    'SELECT raw_json FROM heroes WHERE id = ?',
    id,
  );

  return row ? JSON.parse(row.raw_json) as Hero : undefined;
}

export async function getHeroVideosFromDatabase(): Promise<HeroVideo[]> {
  const rows = await queryRows<{
    hero_id: string | null;
    role: HeroVideo['role'];
    video_type: HeroVideo['videoType'];
    youtube_id: string;
    title: string;
  }>(
    `SELECT hero_id, role, video_type, youtube_id, title
    FROM hero_videos
    ORDER BY sort_order, title COLLATE NOCASE`,
  );

  return rows.map((row) => ({
    heroId: row.hero_id,
    role: row.role,
    videoType: row.video_type,
    youtubeId: row.youtube_id,
    title: row.title,
  }));
}

export async function getHomePortalsFromDatabase(): Promise<PortalCard[]> {
  return queryRows<{ raw_json: string }>(
    'SELECT raw_json FROM home_portals ORDER BY sort_order, title COLLATE NOCASE',
  ).then((rows) => rows.map((row) => JSON.parse(row.raw_json) as PortalCard));
}

export async function getHomeContentBlocksFromDatabase(): Promise<Partial<HomeContent>> {
  const rows = await queryRows<{ content_key: keyof HomeContent; payload_json: string }>(
    'SELECT content_key, payload_json FROM home_content_blocks',
  );

  return rows.reduce<Partial<HomeContent>>((content, row) => ({
    ...content,
    [row.content_key]: JSON.parse(row.payload_json),
  }), {});
}

export async function getGlossaryTermsFromDatabase(): Promise<GlossaryTerm[]> {
  return queryRows<{ raw_json: string }>(
    'SELECT raw_json FROM glossary_terms ORDER BY term COLLATE NOCASE',
  ).then((rows) => rows.map((row) => JSON.parse(row.raw_json) as GlossaryTerm));
}

export async function getExternalSourceFromDatabase(sourceKey: string): Promise<unknown | undefined> {
  const row = await queryOne<{ payload_json: string }>(
    'SELECT payload_json FROM external_sources WHERE source_key = ?',
    sourceKey,
  );

  return row ? JSON.parse(row.payload_json) : undefined;
}

export async function getTierListFromDatabase(
  seasonId?: number,
  rankFilter = '5+',
): Promise<TierListResponse | undefined> {
  try {
    const selectedSeasonId = seasonId ?? await getLatestTierListSeasonId();
    const row = await queryOne<{ payload_json: string }>(
      `SELECT payload_json
      FROM tier_list_rank_snapshots
      WHERE season_id = ? AND rank_filter = ?`,
      selectedSeasonId,
      rankFilter,
    );

    if (row) {
      return JSON.parse(row.payload_json) as TierListResponse;
    }

    const fallback = await queryOne<{ payload_json: string }>(
      `SELECT payload_json
      FROM tier_list_rank_snapshots
      WHERE season_id = ?
      ORDER BY rank_filter = '5+' DESC, updated_at DESC
      LIMIT 1`,
      selectedSeasonId,
    );

    return fallback ? JSON.parse(fallback.payload_json) as TierListResponse : undefined;
  } catch {
    return undefined;
  }
}

export async function getContentStatusFromDatabase(): Promise<ContentStatus> {
  return {
    databaseProvider: 'turso',
    databaseUrl: getSafeDatabaseUrl(),
    configured: Boolean(process.env['TURSO_DATABASE_URL'] && process.env['TURSO_AUTH_TOKEN']),
    heroes: await getCount('heroes'),
    glossaryTerms: await getCount('glossary_terms'),
    externalSources: await getCount('external_sources'),
    heroVideos: await getCount('hero_videos'),
    homePortals: await getCount('home_portals'),
    homeContentBlocks: await getCount('home_content_blocks'),
    tierListSeasons: await getOptionalCount('tier_list_seasons'),
    tierListItems: await getOptionalCount('tier_list_items'),
    gameStatSnapshots: await getOptionalCount('game_stat_snapshots'),
    gameStatSnapshotGames: await getOptionalCount('game_stat_snapshot_games'),
  };
}

async function queryRows<T>(sql: string, ...params: unknown[]): Promise<T[]> {
  const result = await getClient().execute(sql, params as never[]);

  return result.rows as unknown as T[];
}

async function queryOne<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
  const rows = await queryRows<T>(sql, ...params);

  return rows[0];
}

async function getCount(tableName: string): Promise<number> {
  const row = await queryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM ${tableName}`);

  return row?.count ?? 0;
}

async function getOptionalCount(tableName: string): Promise<number> {
  try {
    return await getCount(tableName);
  } catch {
    return 0;
  }
}

async function getLatestTierListSeasonId(): Promise<number | undefined> {
  const row = await queryOne<{ source_season_id: number }>(
    `SELECT source_season_id
    FROM tier_list_seasons
    ORDER BY source_season_id DESC
    LIMIT 1`,
  );

  return row?.source_season_id;
}

function getClient(): Client {
  if (client) {
    return client;
  }

  const url = process.env['TURSO_DATABASE_URL'];
  const authToken = process.env['TURSO_AUTH_TOKEN'];

  if (!url || !authToken) {
    throw new Error('Turso is not configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
  }

  client = createClient({
    url,
    authToken,
  });

  return client;
}

function getSafeDatabaseUrl(): string {
  const url = process.env['TURSO_DATABASE_URL'];

  if (!url) {
    return 'not configured';
  }

  return url.replace(/\/\/([^./]+)[^.]*/, '//$1...');
}
