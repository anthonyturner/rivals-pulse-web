import type { HeroPairs } from './contracts/hero-pairs.model.js';
import { baseGameIdByGameId } from './hero-game-ids.js';
import { deriveHeroPairs, HERO_PAIR_PLAY_MODE_IDS, type HeroPairKind, type HeroPairRow } from './hero-pairs.js';
import { readHeroStatsSource } from './hero-stats-read.js';
import { answerReader, callSupabaseFunction, orWhenNotDeployed, type SupabaseReadEnv } from './supabase-rpc.js';

export interface HeroPairsReadOptions {
  env?: SupabaseReadEnv;
  fetch?: typeof fetch;
  now?: () => Date;
}

const READ_FUNCTION = 'read_hero_pairs';
const { recordsOf, numberOf, stringOf } = answerReader(READ_FUNCTION);

/** PostgREST's `max-rows` on Supabase: a page of this many rows may be cut short. */
const PAGE_SIZE = 1000;

/** Stops a function that ignores `offset` from being read forever; far above any real count of pairs. */
const MAX_PAGES = 200;

/**
 * Reads the pair counts through `public.read_hero_pairs(smallint[])`, summed over the modes asked
 * for. The function returns a set of rows in a stable order, which PostgREST cuts at `max-rows`, so
 * this pages through it with `offset` until a page comes back empty. Stopping on an empty page, not
 * a short one, keeps it right if the project's `max-rows` is ever set below the page size.
 */
export async function fetchHeroPairRows(
  env: SupabaseReadEnv,
  fetcher: typeof fetch = fetch,
  playModeIds: readonly number[] = HERO_PAIR_PLAY_MODE_IDS,
): Promise<HeroPairRow[]> {
  const rows: HeroPairRow[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const body = await callSupabaseFunction(
      'Hero pairs',
      READ_FUNCTION,
      { p_play_mode_ids: playModeIds },
      env,
      fetcher,
      { offset: rows.length, limit: PAGE_SIZE },
    );
    const received = parseHeroPairRows(body);

    if (received.length === 0) {
      return rows;
    }

    rows.push(...received);
  }

  throw new Error(`${READ_FUNCTION}: more than ${MAX_PAGES} pages of rows`);
}

/** Picks the known fields out of the function's answer and rejects anything that is not a number or a known kind. */
export function parseHeroPairRows(body: unknown): HeroPairRow[] {
  return recordsOf(body, 'the answer').map(
    (row): HeroPairRow => ({
      halfSeason: numberOf(row, 'half_season'),
      rankBucket: numberOf(row, 'rank_bucket'),
      kind: kindOf(stringOf(row, 'kind')),
      gameHeroId: numberOf(row, 'hero_id'),
      otherGameHeroId: numberOf(row, 'other_hero_id'),
      decidedMatches: numberOf(row, 'decided_matches'),
      decidedLines: numberOf(row, 'decided_lines'),
      wins: numberOf(row, 'wins'),
    }),
  );
}

function kindOf(value: string): HeroPairKind {
  if (value !== 'vs' && value !== 'with') {
    throw new Error(`${READ_FUNCTION}: kind is neither vs nor with`);
  }

  return value;
}

/**
 * The site's hero pair counts. A game hero id with no mapping is left out and logged (hero id 0 is
 * "no hero recorded" and always lands here); it never fails the request. The half-seasons and the
 * per-hero counts come from the same `read_hero_stats()` answer the hero stats use, so both read the
 * same current half-season. A read function that is not in the database yet is the empty state.
 */
export async function getHeroPairs(options: HeroPairsReadOptions = {}): Promise<HeroPairs> {
  const env = options.env ?? process.env;
  const [rows, source] = await Promise.all([
    orWhenNotDeployed(fetchHeroPairRows(env, options.fetch), READ_FUNCTION, []),
    readHeroStatsSource(env, options.fetch),
  ]);
  const { pairs, excludedGameIds } = deriveHeroPairs(rows, source, {
    now: (options.now ?? (() => new Date()))(),
    baseGameIdByGameId,
  });

  if (excludedGameIds.length > 0) {
    console.warn(`Hero pairs left out game hero ids with no hero mapping: ${excludedGameIds.join(', ')}`);
  }

  return pairs;
}
