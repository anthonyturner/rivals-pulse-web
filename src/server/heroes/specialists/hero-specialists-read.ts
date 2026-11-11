import type { SupabaseClient } from '@supabase/supabase-js';

import type { HeroSpecialists } from '../../../contracts/hero-specialists.model.ts';
import { heroSlugByGameId } from '../catalog/index.ts';
import { getHeroStats, readHeroStatsSource } from '../stats/index.ts';
import { answerReader, callReadFunction, getSupabaseClient, type SupabaseReadEnv } from '../../supabase/index.ts';
import { chooseSpecialistsHalfSeason, deriveHeroSpecialists, type HeroSpecialistRow } from './hero-specialists.ts';

interface HeroSpecialistsReadOptions {
  /** The service-role client the pooled read goes through. */
  client?: SupabaseClient;
  env?: SupabaseReadEnv;
  fetch?: typeof fetch;
  now?: () => Date;
  /** Hero id to role, for the hero stats this reads; see `getHeroStats`. */
  loadHeroRoles?: () => Promise<ReadonlyMap<string, string>>;
}

const READ_FUNCTION = 'read_hero_specialists';
const { recordsOf, numberOf } = answerReader(READ_FUNCTION);

/**
 * Reads `public.read_hero_specialists()`, which is granted to the service role alone and returns
 * pooled counts only, in one JSON value so PostgREST's row limit never cuts it short. Resolves to no
 * row while the migration is not applied, which is the designed "not enough data" state.
 */
export async function fetchHeroSpecialistRows(client: SupabaseClient): Promise<HeroSpecialistRow[]> {
  const body = await callReadFunction(client, READ_FUNCTION);

  return body === null ? [] : parseHeroSpecialistRows(body);
}

/** Picks the known fields out of the function's answer and rejects anything that is not a number. */
export function parseHeroSpecialistRows(body: unknown): HeroSpecialistRow[] {
  return recordsOf(body, 'the answer').map(
    (row): HeroSpecialistRow => ({
      halfSeason: numberOf(row, 'half_season'),
      gameHeroId: numberOf(row, 'hero_id'),
      specialistMatches: numberOf(row, 'specialist_matches'),
      specialistWins: numberOf(row, 'specialist_wins'),
      flexMatches: numberOf(row, 'flex_matches'),
      flexWins: numberOf(row, 'flex_wins'),
    }),
  );
}

/**
 * The site's specialist and flex figures. The half-seasons and each hero's own record come from the
 * same `read_hero_stats()` answer the hero stats use (`getHeroStats` for the half-season shown), so
 * the figures sit in the half-season and beside the win rate the hero stats show. A game hero id with
 * no mapping is left out and logged; it never fails the request. A read function that is not in the
 * database yet is the empty state.
 */
export async function getHeroSpecialists(options: HeroSpecialistsReadOptions = {}): Promise<HeroSpecialists> {
  const env = options.env ?? process.env;
  const now = (options.now ?? (() => new Date()))();
  const [rows, source] = await Promise.all([
    fetchHeroSpecialistRows(options.client ?? getSupabaseClient()),
    readHeroStatsSource(env, options.fetch),
  ]);
  const choice = chooseSpecialistsHalfSeason(rows, source.halfSeasons, now, heroSlugByGameId);
  const ownStats =
    choice.shown === undefined
      ? undefined
      : await getHeroStats({
          env,
          fetch: options.fetch,
          now: () => now,
          halfSeason: choice.shown,
          loadHeroRoles: options.loadHeroRoles,
        });
  const { specialists, excludedGameIds } = deriveHeroSpecialists(rows, choice, ownStats, heroSlugByGameId);

  if (excludedGameIds.length > 0) {
    console.warn(`Hero specialists left out game hero ids with no hero mapping: ${excludedGameIds.join(', ')}`);
  }

  return specialists;
}
