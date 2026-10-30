import type { HeroStats } from './contracts/hero-stats.model.js';
import { heroSlugByGameId } from './hero-game-ids.js';
import {
  deriveHeroStats,
  type HeroAggregateRow,
  type HeroStatsSource,
  type MatchTotalsRow,
} from './hero-stats.js';
import { answerReader, callSupabaseFunction, type SupabaseReadEnv } from './supabase-rpc.js';

export type HeroStatsEnv = SupabaseReadEnv;

export interface HeroStatsReadOptions {
  env?: HeroStatsEnv;
  fetch?: typeof fetch;
  now?: () => Date;
  /** One exact half-season instead of the current one; see `DeriveHeroStatsOptions`. */
  halfSeason?: number;
}

const READ_FUNCTION = 'read_hero_stats';
const { recordOf, recordsOf, numberOf, stringOf } = answerReader(READ_FUNCTION);

/** Reads the aggregates through `public.read_hero_stats()`; see `callSupabaseFunction`. */
export async function fetchHeroStatsSource(
  env: HeroStatsEnv,
  fetcher: typeof fetch = fetch,
): Promise<HeroStatsSource> {
  return parseHeroStatsSource(await callSupabaseFunction('Hero stats', READ_FUNCTION, {}, env, fetcher));
}

/** Picks the known fields out of the function's answer and rejects anything that is not a number. */
export function parseHeroStatsSource(body: unknown): HeroStatsSource {
  const payload = recordOf(body, 'the answer');

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
