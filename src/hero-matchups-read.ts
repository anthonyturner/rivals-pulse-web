import type { HeroMatchups } from './contracts/hero-matchups.model.js';
import { heroSlugByGameId } from './hero-game-ids.js';
import {
  deriveHeroMatchups,
  HERO_MATCHUP_PLAY_MODE_IDS,
  type HeroMatchupRow,
} from './hero-matchups.js';
import { readHeroStatsSource } from './hero-stats-read.js';
import { answerReader, callSupabaseFunction, orWhenNotDeployed, type SupabaseReadEnv } from './supabase-rpc.js';

export interface HeroMatchupsReadOptions {
  env?: SupabaseReadEnv;
  fetch?: typeof fetch;
  now?: () => Date;
}

const READ_FUNCTION = 'read_hero_matchups';
const { recordsOf, numberOf } = answerReader(READ_FUNCTION);

/**
 * Reads the matchups through `public.read_hero_matchups(smallint[])`, summed over the modes asked
 * for. The database applies its minimum to that sum, so the rows hold no thin pair; the derivation
 * applies the minimum again once game hero ids are merged into heroes.
 */
export async function fetchHeroMatchupRows(
  env: SupabaseReadEnv,
  fetcher: typeof fetch = fetch,
  playModeIds: readonly number[] = HERO_MATCHUP_PLAY_MODE_IDS,
): Promise<HeroMatchupRow[]> {
  return parseHeroMatchupRows(
    await callSupabaseFunction('Hero matchups', READ_FUNCTION, { p_play_mode_ids: playModeIds }, env, fetcher),
  );
}

/** Picks the known fields out of the function's answer and rejects anything that is not a number. */
export function parseHeroMatchupRows(body: unknown): HeroMatchupRow[] {
  return recordsOf(body, 'the answer').map(
    (row): HeroMatchupRow => ({
      halfSeason: numberOf(row, 'half_season'),
      gameHeroId: numberOf(row, 'hero_id'),
      enemyGameHeroId: numberOf(row, 'enemy_hero_id'),
      decidedMatches: numberOf(row, 'decided_matches'),
      decidedLines: numberOf(row, 'decided_lines'),
      wins: numberOf(row, 'wins'),
    }),
  );
}

/**
 * The site's hero-against-hero records. A game hero id with no mapping is left out and logged (hero
 * id 0 is "no hero recorded" and always lands here); it never fails the request. The half-season
 * start dates come from the same `read_hero_stats()` answer the hero stats use, so both read the
 * same current half-season. A read function that is not in the database yet is the empty state.
 */
export async function getHeroMatchups(options: HeroMatchupsReadOptions = {}): Promise<HeroMatchups> {
  const env = options.env ?? process.env;
  const [rows, source] = await Promise.all([
    orWhenNotDeployed(fetchHeroMatchupRows(env, options.fetch), READ_FUNCTION, []),
    readHeroStatsSource(env, options.fetch),
  ]);
  const { matchups, excludedGameIds } = deriveHeroMatchups(rows, source.halfSeasons, {
    now: (options.now ?? (() => new Date()))(),
    heroSlugByGameId,
  });

  if (excludedGameIds.length > 0) {
    console.warn(`Hero matchups left out game hero ids with no hero mapping: ${excludedGameIds.join(', ')}`);
  }

  return matchups;
}
