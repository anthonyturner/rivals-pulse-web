import type { HeroSwitchIns } from '../../../contracts/hero-switch-ins.model.ts';
import { heroSlugByGameId } from '../catalog/index.ts';
import { HERO_MATCHUP_PLAY_MODE_IDS } from '../matchups/hero-matchups.ts';
import { fetchHeroMatchupRows } from '../matchups/hero-matchups-read.ts';
import { readHeroStatsSource } from '../stats/index.ts';
import { answerReader, callSupabaseFunction, orWhenNotDeployed, type SupabaseReadEnv } from '../../supabase/index.ts';
import { deriveHeroSwitchIns, SWITCH_IN_PLAY_MODE_IDS, type HeroSwitchInRow } from './hero-switch-ins.ts';

interface HeroSwitchInsReadOptions {
  env?: SupabaseReadEnv;
  fetch?: typeof fetch;
  now?: () => Date;
}

const READ_FUNCTION = 'read_hero_switch_ins';
const MATCHUP_FUNCTION = 'read_hero_matchups';
const { answerOf, recordsOf, numberOf } = answerReader(READ_FUNCTION);

/**
 * Reads the switch-ins through `public.read_hero_switch_ins(smallint[])`, summed over the modes asked
 * for. The function returns one JSON value, so PostgREST's row limit never cuts it short. The
 * database applies its recorder gate to each mode before summing, so the rows hold no thin pairing;
 * the derivation applies the minimum again once game hero ids are merged into heroes.
 */
export async function fetchHeroSwitchInRows(
  env: SupabaseReadEnv,
  fetcher: typeof fetch = fetch,
  playModeIds: readonly number[] = SWITCH_IN_PLAY_MODE_IDS,
): Promise<HeroSwitchInRow[]> {
  return parseHeroSwitchInRows(
    await callSupabaseFunction('Hero switch-ins', READ_FUNCTION, { p_play_mode_ids: playModeIds }, env, fetcher),
  );
}

/** Picks the known fields out of the function's answer and rejects anything that is not a number. */
export function parseHeroSwitchInRows(body: unknown): HeroSwitchInRow[] {
  return recordsOf(answerOf(body)['switch_ins'], 'switch_ins').map(
    (row): HeroSwitchInRow => ({
      halfSeason: numberOf(row, 'half_season'),
      gameHeroId: numberOf(row, 'hero_id'),
      enemyGameHeroId: numberOf(row, 'enemy_hero_id'),
      decidedMatches: numberOf(row, 'decided_matches'),
      decidedSwitches: numberOf(row, 'decided_switches'),
      wins: numberOf(row, 'wins'),
    }),
  );
}

/**
 * The site's switch-ins, each beside the hero's overall record against that enemy in the same
 * half-season. A game hero id with no mapping is left out and logged (hero id 0 is "no hero
 * recorded" and always lands here); it never fails the request. The half-season start dates come from
 * the same `read_hero_stats()` answer the hero stats use, so all of them read the same current
 * half-season. A read function that is not in the database yet is the empty state.
 */
export async function getHeroSwitchIns(options: HeroSwitchInsReadOptions = {}): Promise<HeroSwitchIns> {
  const env = options.env ?? process.env;
  const [rows, matchupRows, source] = await Promise.all([
    orWhenNotDeployed(fetchHeroSwitchInRows(env, options.fetch), READ_FUNCTION, []),
    orWhenNotDeployed(fetchHeroMatchupRows(env, options.fetch, HERO_MATCHUP_PLAY_MODE_IDS), MATCHUP_FUNCTION, []),
    readHeroStatsSource(env, options.fetch),
  ]);
  const { switchIns, excludedGameIds } = deriveHeroSwitchIns(rows, matchupRows, source.halfSeasons, {
    now: (options.now ?? (() => new Date()))(),
    heroSlugByGameId,
  });

  if (excludedGameIds.length > 0) {
    console.warn(`Hero switch-ins left out game hero ids with no hero mapping: ${excludedGameIds.join(', ')}`);
  }

  return switchIns;
}
