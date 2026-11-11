import type { HeroMatchups } from '../../../contracts/hero-matchups.model.ts';
import { heroSlugByGameId } from '../catalog/index.ts';
import {
  deriveHeroMatchups,
  HERO_MATCHUP_PLAY_MODE_IDS,
  type HeroMatchupFigures,
  type HeroMatchupRow,
} from './hero-matchups.ts';
import { getHeroPairs } from '../pairs/index.ts';
import { answerReader, callSupabaseFunction, orWhenNotDeployed, type SupabaseReadEnv } from '../../supabase/index.ts';

interface HeroMatchupsReadOptions {
  env?: SupabaseReadEnv;
  fetch?: typeof fetch;
  now?: () => Date;
}

const READ_FUNCTION = 'read_hero_matchups';
const { recordsOf, numberOf, nullableNumberOf } = answerReader(READ_FUNCTION);

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
      figures: figuresOf(row),
    }),
  );
}

/**
 * The figures of a row, or null when any is missing or null: the answer of a database that does not
 * have them yet leaves the keys out, and a half-season frozen before then returns them as null.
 */
function figuresOf(row: Record<string, unknown>): HeroMatchupFigures | null {
  const figure = (key: string): number | null => (row[key] === undefined ? null : nullableNumberOf(row, key));
  const killsSum = figure('kills_sum');
  const killsN = figure('kills_n');
  const deathsSum = figure('deaths_sum');
  const deathsN = figure('deaths_n');
  const assistsSum = figure('assists_sum');
  const assistsN = figure('assists_n');
  const finalHitsSum = figure('final_hits_sum');
  const finalHitsN = figure('final_hits_n');

  if (
    killsSum === null ||
    killsN === null ||
    deathsSum === null ||
    deathsN === null ||
    assistsSum === null ||
    assistsN === null ||
    finalHitsSum === null ||
    finalHitsN === null
  ) {
    return null;
  }

  return { killsSum, killsN, deathsSum, deathsN, assistsSum, assistsN, finalHitsSum, finalHitsN };
}

/**
 * The site's hero-against-hero records: the pair counts of `getHeroPairs` (the answer behind
 * `/api/hero-pairs` and the Pulse Atlas `community-stats`), named by hero and judged by the counter
 * rule the overlay uses, with each pair's KDA and final hits added from `hero_matchups`. A game hero
 * id with no mapping is left out and logged (hero id 0 is "no hero recorded"); it never fails the
 * request. A read function that is not in the database yet is the empty state, and a database that
 * has the pair counts but not the figures answers without them.
 */
export async function getHeroMatchups(options: HeroMatchupsReadOptions = {}): Promise<HeroMatchups> {
  const env = options.env ?? process.env;
  const [pairs, figureRows] = await Promise.all([
    getHeroPairs(options),
    orWhenNotDeployed(fetchHeroMatchupRows(env, options.fetch), READ_FUNCTION, []),
  ]);
  const { matchups, excludedGameIds } = deriveHeroMatchups(pairs, figureRows, { heroSlugByGameId });

  if (excludedGameIds.length > 0) {
    console.warn(`Hero matchups left out game hero ids with no hero mapping: ${excludedGameIds.join(', ')}`);
  }

  return matchups;
}
