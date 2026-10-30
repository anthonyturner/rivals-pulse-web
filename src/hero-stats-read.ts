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
import { answerReader, callSupabaseFunction, orWhenNotDeployed, type SupabaseReadEnv } from './supabase-rpc.js';

export type HeroStatsEnv = SupabaseReadEnv;

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
const { answerOf, recordsOf, numberOf, stringOf } = answerReader(READ_FUNCTION);

/** Reads the aggregates through `public.read_hero_stats()`; see `callSupabaseFunction`. */
export async function fetchHeroStatsSource(
  env: HeroStatsEnv,
  fetcher: typeof fetch = fetch,
): Promise<HeroStatsSource> {
  return parseHeroStatsSource(await callSupabaseFunction('Hero stats', READ_FUNCTION, {}, env, fetcher));
}

/** The source before any match is recorded: what the readers get while the read function is not deployed. */
const EMPTY_SOURCE: HeroStatsSource = { halfSeasons: [], totals: [], heroes: [] };

/**
 * `fetchHeroStatsSource`, or an empty source while `read_hero_stats` is not in the database yet.
 * Every reader of the hero aggregates goes through this, so a migration that is not applied yet is
 * the empty state everywhere and an outage is an error everywhere.
 */
export function readHeroStatsSource(env: HeroStatsEnv, fetcher: typeof fetch = fetch): Promise<HeroStatsSource> {
  return orWhenNotDeployed(fetchHeroStatsSource(env, fetcher), READ_FUNCTION, EMPTY_SOURCE);
}

/** Picks the known fields out of the function's answer and rejects anything that is not a number. */
export function parseHeroStatsSource(body: unknown): HeroStatsSource {
  const payload = answerOf(body);

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
  const source = await readHeroStatsSource(options.env ?? process.env, options.fetch);
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
 * See `readHeroStatsSource` for a read function that is not in the database yet.
 */
export async function getRoleStats(options: RoleStatsReadOptions = {}): Promise<RoleStats> {
  const source = await readHeroStatsSource(options.env ?? process.env, options.fetch);
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
