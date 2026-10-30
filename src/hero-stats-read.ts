import type { HeroStats } from './contracts/hero-stats.model.js';
import type { RoleStats } from './contracts/role-stats.model.js';
import { buildHeroRoleByGameId, heroGameIdEntries, heroSlugByGameId } from './hero-game-ids.js';
import { listHeroRoles } from './hero-store.js';
import {
  deriveHeroStats,
  type HeroAggregateRow,
  type HeroStatsSource,
  type MatchTotalsRow,
} from './hero-stats.js';
import { deriveRoleStats } from './role-stats.js';
import { getSupabaseClient } from './supabase-client.js';

export const HERO_STATS_ENV_NAMES = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY'] as const;

export type HeroStatsEnv = Readonly<Record<string, string | undefined>>;

export interface HeroStatsReadOptions {
  env?: HeroStatsEnv;
  fetch?: typeof fetch;
  now?: () => Date;
  /** One exact half-season instead of the current one; see `DeriveHeroStatsOptions`. */
  halfSeason?: number;
}

export interface RoleStatsReadOptions extends HeroStatsReadOptions {
  /** Hero id to role. By default read from `hero_content` through the shared Supabase client. */
  loadHeroRoles?: () => Promise<ReadonlyMap<string, string>>;
}

const READ_FUNCTION = 'read_hero_stats';
const READ_TIMEOUT_MS = 5000;

/** The read function answered with an error status. */
export class HeroStatsReadError extends Error {
  constructor(readonly status: number) {
    super(`${READ_FUNCTION} answered ${status}`);
    this.name = 'HeroStatsReadError';
  }
}

/**
 * Reads the aggregates through `public.read_hero_stats()` over PostgREST (Supabase's REST layer)
 * with the publishable key. That function is the only thing the key can reach: the aggregate
 * tables themselves have no grant, so a leaked key reads nothing it should not.
 */
export async function fetchHeroStatsSource(
  env: HeroStatsEnv,
  fetcher: typeof fetch = fetch,
): Promise<HeroStatsSource> {
  const url = env['SUPABASE_URL']?.trim();
  const key = env['SUPABASE_PUBLISHABLE_KEY']?.trim();

  if (!url || !key) {
    const missing = HERO_STATS_ENV_NAMES.filter((name) => !env[name]?.trim());
    throw new Error(`Hero stats are not configured. Set ${missing.join(' and ')}.`);
  }

  const response = await fetcher(`${url.replace(/\/+$/, '')}/rest/v1/rpc/${READ_FUNCTION}`, {
    method: 'POST',
    headers: { apikey: key, 'content-type': 'application/json' },
    body: '{}',
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new HeroStatsReadError(response.status);
  }

  return parseHeroStatsSource(await response.json());
}

/** Picks the known fields out of the function's answer and rejects anything that is not a number. */
export function parseHeroStatsSource(body: unknown): HeroStatsSource {
  const payload = recordOf(body, READ_FUNCTION);

  return {
    halfSeasons: recordsOf(payload['half_seasons'], 'half_seasons').map((row) => ({
      halfSeason: numberOf(row, 'half_season'),
      startsAt: stringOf(row, 'starts_at'),
    })),
    totals: recordsOf(payload['totals'], 'totals').map(
      (row): MatchTotalsRow => ({
        halfSeason: numberOf(row, 'half_season'),
        playModeId: numberOf(row, 'play_mode_id'),
        decidedMatches: numberOf(row, 'decided_matches'),
      }),
    ),
    heroes: recordsOf(payload['heroes'], 'heroes').map(
      (row): HeroAggregateRow => ({
        halfSeason: numberOf(row, 'half_season'),
        playModeId: numberOf(row, 'play_mode_id'),
        gameHeroId: numberOf(row, 'hero_id'),
        decidedLines: numberOf(row, 'decided_lines'),
        wins: numberOf(row, 'wins'),
        killsSum: numberOf(row, 'kills_sum'),
        killsN: numberOf(row, 'kills_n'),
        deathsSum: numberOf(row, 'deaths_sum'),
        deathsN: numberOf(row, 'deaths_n'),
        assistsSum: numberOf(row, 'assists_sum'),
        assistsN: numberOf(row, 'assists_n'),
        finalHitsSum: numberOf(row, 'final_hits_sum'),
        finalHitsN: numberOf(row, 'final_hits_n'),
      }),
    ),
  };
}

/**
 * The `halfSeason` query value as a half-season number. A value that is not a number comes back as
 * NaN, which matches no half-season and so gets the empty state rather than the current one.
 */
export function halfSeasonFromQuery(value: string | undefined): number | undefined {
  return value === undefined || value.trim() === '' ? undefined : Number(value);
}

/**
 * The site's hero stats. A game hero id with no mapping is left out of the numbers and logged
 * (hero id 0 is "no hero recorded" and always lands here); it never fails the request.
 */
export async function getHeroStats(options: HeroStatsReadOptions = {}): Promise<HeroStats> {
  const source = await fetchHeroStatsSource(options.env ?? process.env, options.fetch);
  const { stats, excludedGameIds } = deriveHeroStats(source, {
    now: (options.now ?? (() => new Date()))(),
    halfSeason: options.halfSeason,
    heroSlugByGameId,
  });

  if (excludedGameIds.length > 0) {
    console.warn(`Hero stats left out game hero ids with no hero mapping: ${excludedGameIds.join(', ')}`);
  }

  return stats;
}

/**
 * The site's role benchmarks, pooled from the same per-hero counts as the hero stats. The role of a
 * hero is the one it has now (`hero_content`), except that a hero the game splits by role counts
 * toward the role that was played. A game hero id with no role is left out and logged.
 *
 * PostgREST answers 404 when the read function is not in the database yet (the migration has not
 * been applied), which is the designed empty state here and not a failure.
 */
export async function getRoleStats(options: RoleStatsReadOptions = {}): Promise<RoleStats> {
  const source = await fetchHeroStatsSource(options.env ?? process.env, options.fetch).catch(
    (error: unknown): HeroStatsSource => {
      if (error instanceof HeroStatsReadError && error.status === 404) {
        console.warn(`${READ_FUNCTION} is not in the database yet; role stats show the empty state`);

        return { halfSeasons: [], totals: [], heroes: [] };
      }

      throw error;
    },
  );
  const roleBySlug =
    source.heroes.length === 0
      ? new Map<string, string>()
      : await (options.loadHeroRoles ?? (() => listHeroRoles(getSupabaseClient())))();
  const { stats, excludedGameIds } = deriveRoleStats(source, {
    now: (options.now ?? (() => new Date()))(),
    halfSeason: options.halfSeason,
    roleByGameId: buildHeroRoleByGameId(heroGameIdEntries, roleBySlug),
  });

  if (excludedGameIds.length > 0) {
    console.warn(`Role stats left out game hero ids with no role: ${excludedGameIds.join(', ')}`);
  }

  return stats;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function recordOf(value: unknown, what: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${what} did not return an object`);
  }

  return value;
}

function recordsOf(value: unknown, what: string): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error(`${READ_FUNCTION}: ${what} is not a list`);
  }

  return value.map((row) => recordOf(row, `${READ_FUNCTION}: a ${what} entry`));
}

function numberOf(row: Record<string, unknown>, key: string): number {
  const value = row[key];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${READ_FUNCTION}: ${key} is not a number`);
  }

  return value;
}

function stringOf(row: Record<string, unknown>, key: string): string {
  const value = row[key];

  if (typeof value !== 'string') {
    throw new Error(`${READ_FUNCTION}: ${key} is not a string`);
  }

  return value;
}
