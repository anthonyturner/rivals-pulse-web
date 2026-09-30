import { connect, type Connection } from '@tursodatabase/serverless';

import type {
  TierListHero,
  TierListRankFilter,
  TierListResponse,
  TierListSeason,
  TierListTier,
  TierName,
} from './contracts/tier-list.model.js';

const nodeProcess = process as typeof process & {
  loadEnvFile?: (path?: string) => void;
};

try {
  nodeProcess.loadEnvFile?.('.env');
} catch {
  // Environment variables may already be provided by the shell or deployment host.
}

const SOURCE_NAME = 'Rivals Meta';
const SOURCE_URL = 'https://rivalsmeta.com/tier-list';
const API_BASE = 'https://rivalsmeta.com/api';
const TIERS: TierName[] = ['S', 'A', 'B', 'C', 'D', 'F'];
const DIAMOND_PLUS_FILTER = '5+';

export const TIER_LIST_RANK_FILTERS: TierListRankFilter[] = [
  { value: '99', label: 'All Ranks' },
  { value: '1', label: 'Bronze' },
  { value: '2', label: 'Silver' },
  { value: '3', label: 'Gold' },
  { value: '4', label: 'Platinum' },
  { value: '5', label: 'Diamond' },
  { value: DIAMOND_PLUS_FILTER, label: 'Diamond+' },
  { value: '6', label: 'Grandmaster' },
  { value: '6+', label: 'Grandmaster+' },
  { value: '7', label: 'Celestial' },
  { value: '7+', label: 'Celestial+' },
  { value: '8', label: 'Eternity' },
  { value: '9+', label: 'Eternity+' },
  { value: '9', label: 'One Above All' },
];

const RANK_GROUPS: Record<string, string[]> = {
  '5+': ['5', '6', '7', '8', '9'],
  '6+': ['6', '7', '8', '9'],
  '7+': ['7', '8'],
  '9+': ['7', '8', '9'],
};

interface RivalsMetaSeason {
  id: number;
  seasonNumber: number;
  half: number;
  subSeason: string;
  name: string;
  description: string;
  halfName: string;
  startTime: string;
  endTime: string;
}

interface RivalsMetaHero {
  hero_id: number;
  name: string;
  role: string;
}

interface RivalsMetaStatsHero {
  hero_id: number;
  matches?: number;
  wins?: number;
  wr_matches?: number;
  wr_wins?: number;
}

interface RivalsMetaStatsBan {
  hero_id: number;
  bans?: number;
}

interface AggregatedHeroStats {
  hero_id: number;
  matches: number;
  wins: number;
  wr_matches: number;
  wr_wins: number;
}

interface AggregatedBanStats {
  hero_id: number;
  bans: number;
}

interface RivalsMetaStatsRank<T> {
  rank: string;
  heroes?: T[];
  bans?: T[];
}

interface RivalsMetaStatsResponse {
  season: number;
  timestamp?: number;
  heroes: Array<RivalsMetaStatsRank<RivalsMetaStatsHero>>;
  bans: Array<RivalsMetaStatsRank<RivalsMetaStatsBan>>;
}

interface DiscoveredRivalsMetaData {
  latestSeason: number;
  seasons: RivalsMetaSeason[];
  heroes: RivalsMetaHero[];
}

let client: Connection | undefined;

export async function syncTierList(): Promise<{
  sourceKey: string;
  status: string;
  seasons: number;
  snapshots: number;
  items: number;
  latestSeason: number;
  message: string;
}> {
  const startedAt = new Date().toISOString();
  const runId = await startSyncRun(startedAt);

  try {
    await ensureTierListSchema();

    const discovered = await discoverRivalsMetaData();
    const heroById = new Map(discovered.heroes.map((hero) => [hero.hero_id, hero]));
    let snapshots = 0;
    let items = 0;

    for (const season of discovered.seasons) {
      const stats = await fetchRivalsMetaStats(season.id);
      const fetchedAt = new Date().toISOString();
      await upsertSeason(season, stats, fetchedAt);

      for (const rankFilter of TIER_LIST_RANK_FILTERS) {
        const payload = buildTierListPayload(discovered, season, stats, heroById, rankFilter, fetchedAt);
        await upsertSnapshot(payload);
        snapshots += 1;
        items += payload.tiers.reduce((total, tier) => total + tier.heroes.length, 0);
      }
    }

    const message = `Synced ${discovered.seasons.length} seasons, ${snapshots} rank snapshots, and ${items} tier rows.`;
    await finishSyncRun(runId, 'success', message);

    return {
      sourceKey: 'tier-list',
      status: 'success',
      seasons: discovered.seasons.length,
      snapshots,
      items,
      latestSeason: discovered.latestSeason,
      message,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sync tier list';
    await finishSyncRun(runId, 'error', message);
    throw error;
  }
}

async function discoverRivalsMetaData(): Promise<DiscoveredRivalsMetaData> {
  const html = await fetchText(SOURCE_URL);
  const scripts = await fetchNuxtScripts(html);

  const seasonScript = scripts.find((script) =>
    script.content.includes('latestSeason') && script.content.includes('seasonNumber'),
  );
  const heroScript = scripts.find((script) => script.content.includes('"hero_id"') && script.content.includes('JSON.parse'));

  if (!seasonScript) {
    throw new Error('Could not find Rivals Meta season data in Nuxt assets.');
  }

  if (!heroScript) {
    throw new Error('Could not find Rivals Meta hero data in Nuxt assets.');
  }

  return {
    ...parseSeasons(seasonScript.content),
    heroes: parseHeroes(heroScript.content),
  };
}

async function fetchNuxtScripts(html: string): Promise<Array<{ path: string; content: string }>> {
  const pending = new Set(Array.from(html.matchAll(/(?:src|href)="([^"]*\/_nuxt\/[^"]+\.js)"/g), (match) => match[1]));
  const fetched = new Map<string, string>();

  while (pending.size) {
    const [path] = pending;
    pending.delete(path);

    if (fetched.has(path)) {
      continue;
    }

    const url = new URL(path, SOURCE_URL).toString();
    const content = await fetchText(url);
    fetched.set(path, content);

    for (const importedPath of findImportedNuxtScriptPaths(content, url)) {
      if (!fetched.has(importedPath)) {
        pending.add(importedPath);
      }
    }
  }

  return [...fetched.entries()].map(([path, content]) => ({ path, content }));
}

function findImportedNuxtScriptPaths(script: string, baseUrl: string): string[] {
  return Array.from(
    script.matchAll(/["']((?:\.\/|\/_nuxt\/)[^"']+\.js)["']/g),
    (match) => {
      const path = match[1].startsWith('./')
        ? new URL(match[1], baseUrl).pathname
        : match[1];

      return path;
    },
  );
}

function parseSeasons(script: string): { latestSeason: number; seasons: RivalsMetaSeason[] } {
  const arrayStartMatch = script.match(/const\s+\w+\s*=\s*\[/);
  const latestSeasonMatch = script.match(/latestSeason\s*:\s*(\d+)/);

  if (!arrayStartMatch || !latestSeasonMatch || arrayStartMatch.index === undefined) {
    throw new Error('Rivals Meta season asset format changed.');
  }

  const arrayStart = script.indexOf('[', arrayStartMatch.index);
  const arraySource = extractBracketedExpression(script, arrayStart, '[', ']');
  const seasons = Function(`"use strict"; return (${arraySource});`)() as RivalsMetaSeason[];

  return {
    latestSeason: Number(latestSeasonMatch[1]),
    seasons,
  };
}

function extractBracketedExpression(
  source: string,
  startIndex: number,
  openCharacter: string,
  closeCharacter: string,
): string {
  let depth = 0;
  let quote: string | undefined;
  let isEscaped = false;

  for (let index = startIndex; index < source.length; index += 1) {
    const character = source[index];

    if (quote) {
      if (isEscaped) {
        isEscaped = false;
      } else if (character === '\\') {
        isEscaped = true;
      } else if (character === quote) {
        quote = undefined;
      }

      continue;
    }

    if (character === '"' || character === '\'' || character === '`') {
      quote = character;
      continue;
    }

    if (character === openCharacter) {
      depth += 1;
    }

    if (character === closeCharacter) {
      depth -= 1;

      if (depth === 0) {
        return source.slice(startIndex, index + 1);
      }
    }
  }

  throw new Error('Could not parse bracketed Rivals Meta data.');
}

function parseHeroes(script: string): RivalsMetaHero[] {
  const match = script.match(/JSON\.parse\((`[\s\S]*?`)\)/);

  if (!match) {
    throw new Error('Rivals Meta hero asset format changed.');
  }

  return Function(`"use strict"; return JSON.parse(${match[1]});`)() as RivalsMetaHero[];
}

async function fetchRivalsMetaStats(seasonId: number): Promise<RivalsMetaStatsResponse> {
  const response = await fetch(`${API_BASE}/heroes/stats?season=${seasonId}`);

  if (!response.ok) {
    throw new Error(`Rivals Meta stats request failed for season ${seasonId}: ${response.status}`);
  }

  return response.json() as Promise<RivalsMetaStatsResponse>;
}

function buildTierListPayload(
  discovered: DiscoveredRivalsMetaData,
  season: RivalsMetaSeason,
  stats: RivalsMetaStatsResponse,
  heroById: Map<number, RivalsMetaHero>,
  rankFilter: TierListRankFilter,
  fetchedAt: string,
): TierListResponse {
  const heroStats = getFilteredHeroStats(stats.heroes, rankFilter.value);
  const banStats = getFilteredBanStats(stats.bans, rankFilter.value);
  const averageMatches = sum(heroStats.map((hero) => hero.matches)) / 6;
  const averageBans = sum([...banStats.values()]) / 2;

  const heroes = heroStats
    .map((stat) => {
      const hero = heroById.get(stat.hero_id);

      if (!hero) {
        return undefined;
      }

      const winRate = stat.wr_matches ? (stat.wr_wins / stat.wr_matches) * 100 : 0;
      const pickRate = averageMatches ? (stat.matches / averageMatches) * 100 : 0;
      const banRate = averageBans ? ((banStats.get(stat.hero_id) ?? 0) / averageBans) * 100 : 0;
      const score = getTierScore(winRate, pickRate, banRate);
      const tier = getTierName(score);

      return {
        heroId: stat.hero_id,
        name: hero.name,
        role: hero.role,
        imageUrl: `/images/heroes/${slugifyHeroName(hero.name)}.png`,
        tier,
        winRate,
        pickRate,
        banRate,
        matches: stat.matches,
        wins: stat.wins,
        score,
      } satisfies TierListHero;
    })
    .filter((hero): hero is TierListHero => Boolean(hero))
    .sort((first, second) => second.winRate - first.winRate);

  const tiers = TIERS.map((tier) => ({
    name: tier,
    heroes: heroes.filter((hero) => hero.tier === tier),
  } satisfies TierListTier));

  return {
    sourceName: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    currentSeasonId: discovered.latestSeason,
    selectedSeasonId: season.id,
    selectedRankFilter: rankFilter.value,
    seasons: discovered.seasons.map((item) => toTierListSeason(item, stats.timestamp, fetchedAt)),
    rankFilters: TIER_LIST_RANK_FILTERS,
    tiers,
    updatedAt: fetchedAt,
  };
}

function getFilteredHeroStats(
  rankedStats: Array<RivalsMetaStatsRank<RivalsMetaStatsHero>>,
  rankFilter: string,
): AggregatedHeroStats[] {
  return mergeRankedStats(rankedStats, rankFilter, 'heroes', () => ({
    hero_id: 0,
    matches: 0,
    wins: 0,
    wr_matches: 0,
    wr_wins: 0,
  }), (current: AggregatedHeroStats, item) => ({
    hero_id: item.hero_id,
    matches: current.matches + (item.matches ?? 0),
    wins: current.wins + (item.wins ?? 0),
    wr_matches: current.wr_matches + (item.wr_matches ?? 0),
    wr_wins: current.wr_wins + (item.wr_wins ?? 0),
  }));
}

function getFilteredBanStats(
  rankedStats: Array<RivalsMetaStatsRank<RivalsMetaStatsBan>>,
  rankFilter: string,
): Map<number, number> {
  const bans = mergeRankedStats(rankedStats, rankFilter, 'bans', () => ({
    hero_id: 0,
    bans: 0,
  }), (current: AggregatedBanStats, item) => ({
    hero_id: item.hero_id,
    bans: current.bans + (item.bans ?? 0),
  }));

  return new Map(bans.filter((item) => item.hero_id !== 0).map((item) => [item.hero_id, item.bans ?? 0]));
}

function mergeRankedStats<TSource extends { hero_id: number }, TAggregate extends { hero_id: number }>(
  rankedStats: Array<RivalsMetaStatsRank<TSource>>,
  rankFilter: string,
  key: 'heroes' | 'bans',
  createEmpty: () => TAggregate,
  merge: (current: TAggregate, item: TSource) => TAggregate,
): TAggregate[] {
  const rankIds = getRankIds(rankFilter);
  const rows = rankFilter === '99' || rankFilter.includes('+')
    ? rankedStats.filter((rank) => rank.rank !== '0' && (rankIds.length === 0 || rankIds.includes(rank.rank)))
    : rankedStats.filter((rank) => rank.rank === rankFilter);

  const byHero = new Map<number, TAggregate>();

  for (const row of rows) {
    for (const item of row[key] ?? []) {
      if (!item.hero_id) {
        continue;
      }

      byHero.set(item.hero_id, merge(byHero.get(item.hero_id) ?? createEmpty(), item));
    }
  }

  return [...byHero.values()];
}

function getRankIds(rankFilter: string): string[] {
  if (rankFilter === '99') {
    return [];
  }

  return RANK_GROUPS[rankFilter] ?? [rankFilter];
}

function getTierScore(winRate: number, pickRate: number, banRate: number): number {
  return Math.round((winRate / 100 * 0.87 + pickRate / 100 * 0.05 + banRate / 100 * 0.08) * 100);
}

function getTierName(score: number): TierName {
  if (score >= 48.5) {
    return 'S';
  }

  if (score >= 45) {
    return 'A';
  }

  if (score >= 42) {
    return 'B';
  }

  if (score >= 38) {
    return 'C';
  }

  return 'D';
}

function slugifyHeroName(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\(([^)]+)\)/g, '$1')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function upsertSeason(
  season: RivalsMetaSeason,
  stats: RivalsMetaStatsResponse,
  fetchedAt: string,
): Promise<void> {
  await execute(
    `INSERT INTO tier_list_seasons (
      source_season_id, season_number, half, sub_season, name, description, half_name,
      start_time, end_time, source_timestamp, raw_stats_json, fetched_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(source_season_id) DO UPDATE SET
      season_number = excluded.season_number,
      half = excluded.half,
      sub_season = excluded.sub_season,
      name = excluded.name,
      description = excluded.description,
      half_name = excluded.half_name,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      source_timestamp = excluded.source_timestamp,
      raw_stats_json = excluded.raw_stats_json,
      fetched_at = excluded.fetched_at,
      updated_at = CURRENT_TIMESTAMP`,
    season.id,
    season.seasonNumber,
    season.half,
    season.subSeason,
    season.name,
    season.description,
    season.halfName,
    season.startTime,
    season.endTime,
    stats.timestamp ?? null,
    JSON.stringify(stats),
    fetchedAt,
  );
}

async function upsertSnapshot(payload: TierListResponse): Promise<void> {
  const rankFilter = TIER_LIST_RANK_FILTERS.find((filter) => filter.value === payload.selectedRankFilter);
  const statements: Array<{ sql: string; args: unknown[] }> = [
    {
      sql: `INSERT INTO tier_list_rank_snapshots (
        season_id, rank_filter, rank_label, source_url, payload_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(season_id, rank_filter) DO UPDATE SET
        rank_label = excluded.rank_label,
        source_url = excluded.source_url,
        payload_json = excluded.payload_json,
        updated_at = CURRENT_TIMESTAMP`,
      args: [
        payload.selectedSeasonId,
        payload.selectedRankFilter,
        rankFilter?.label ?? payload.selectedRankFilter,
        SOURCE_URL,
        JSON.stringify(payload),
      ],
    },
    {
      sql: 'DELETE FROM tier_list_items WHERE season_id = ? AND rank_filter = ?',
      args: [payload.selectedSeasonId, payload.selectedRankFilter],
    },
  ];

  let sortOrder = 0;

  for (const tier of payload.tiers) {
    for (const hero of tier.heroes) {
      statements.push({
        sql: `INSERT INTO tier_list_items (
          season_id, rank_filter, tier, hero_id, hero_name, role, image_url, win_rate,
          pick_rate, ban_rate, matches, wins, score, sort_order, raw_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          payload.selectedSeasonId,
          payload.selectedRankFilter,
          tier.name,
          hero.heroId,
          hero.name,
          hero.role,
          hero.imageUrl,
          hero.winRate,
          hero.pickRate,
          hero.banRate,
          hero.matches,
          hero.wins,
          hero.score,
          sortOrder,
          JSON.stringify(hero),
        ],
      });
      sortOrder += 1;
    }
  }

  await getClient().batch(statements, 'immediate');
}

function toTierListSeason(
  season: RivalsMetaSeason,
  sourceTimestamp: number | undefined,
  fetchedAt: string,
): TierListSeason {
  return {
    id: season.id,
    seasonNumber: season.seasonNumber,
    half: season.half,
    subSeason: season.subSeason,
    label: `Season ${season.subSeason.replace(/^S/, '').replace(/\.0$/, '')}`,
    name: season.name,
    description: season.description,
    halfName: season.halfName,
    startTime: season.startTime,
    endTime: season.endTime,
    sourceTimestamp,
    fetchedAt,
  };
}

async function ensureTierListSchema(): Promise<void> {
  const statements = [
    `CREATE TABLE IF NOT EXISTS tier_list_seasons (
      source_season_id INTEGER PRIMARY KEY,
      season_number INTEGER NOT NULL,
      half INTEGER NOT NULL,
      sub_season TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      half_name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      source_timestamp INTEGER,
      raw_stats_json TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS tier_list_rank_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER NOT NULL REFERENCES tier_list_seasons(source_season_id) ON DELETE CASCADE,
      rank_filter TEXT NOT NULL,
      rank_label TEXT NOT NULL,
      source_url TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (season_id, rank_filter)
    )`,
    `CREATE TABLE IF NOT EXISTS tier_list_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER NOT NULL REFERENCES tier_list_seasons(source_season_id) ON DELETE CASCADE,
      rank_filter TEXT NOT NULL,
      tier TEXT NOT NULL CHECK (tier IN ('S', 'A', 'B', 'C', 'D', 'F')),
      hero_id INTEGER NOT NULL,
      hero_name TEXT NOT NULL,
      role TEXT NOT NULL,
      image_url TEXT NOT NULL,
      win_rate REAL NOT NULL,
      pick_rate REAL NOT NULL,
      ban_rate REAL NOT NULL,
      matches INTEGER NOT NULL,
      wins INTEGER NOT NULL,
      score INTEGER NOT NULL,
      sort_order INTEGER NOT NULL,
      raw_json TEXT NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS idx_tier_list_rank_snapshots_season ON tier_list_rank_snapshots(season_id)',
    'CREATE INDEX IF NOT EXISTS idx_tier_list_items_lookup ON tier_list_items(season_id, rank_filter, tier, sort_order)',
    'CREATE INDEX IF NOT EXISTS idx_tier_list_items_hero ON tier_list_items(hero_id)',
  ];

  for (const statement of statements) {
    await execute(statement);
  }
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status}`);
  }

  return response.text();
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

async function startSyncRun(startedAt: string): Promise<number> {
  const result = await getClient().execute(
    'INSERT INTO sync_runs (source_key, status, started_at) VALUES (?, ?, ?) RETURNING id',
    ['tier-list', 'running', startedAt],
  );

  return Number(result.rows[0]['id']);
}

async function finishSyncRun(runId: number, status: string, message: string): Promise<void> {
  await execute(
    'UPDATE sync_runs SET status = ?, message = ?, finished_at = ? WHERE id = ?',
    status,
    message,
    new Date().toISOString(),
    runId,
  );
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

  client = connect({
    url,
    authToken,
  });

  return client;
}
