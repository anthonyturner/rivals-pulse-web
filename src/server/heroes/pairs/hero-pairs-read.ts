import type { HeroPairs } from '../../../contracts/hero-pairs.model.ts';
import { baseGameIdByGameId } from '../catalog/index.ts';
import {
  deriveHeroPairs,
  HERO_PAIR_PLAY_MODE_IDS,
  UNKNOWN_RANK_BUCKET,
  type HeroPairKind,
  type HeroPairRow,
} from './hero-pairs.ts';
import { readHeroStatsSource } from '../stats/index.ts';
import { answerReader, callSupabaseFunction, orWhenNotDeployed, type SupabaseReadEnv } from '../../supabase/index.ts';

interface HeroPairsReadOptions {
  env?: SupabaseReadEnv;
  fetch?: typeof fetch;
  now?: () => Date;
}

const READ_FUNCTION = 'read_hero_pairs';
const { recordsOf, numberOf, stringOf } = answerReader(READ_FUNCTION);

/** PostgREST's `max-rows` on Supabase: a page of this many rows may be cut short. */
const PAGE_SIZE = 1000;

/** Every row is unique on these columns, so sorting by them makes a range cut the same way on every page. */
const PAGE_ORDER = ['half_season', 'rank_bucket', 'kind', 'hero_id', 'other_hero_id'] as const;

/** Only the rows the `all` band is built from, so the database never has to send the others. */
const PAGE_FILTERS = { rank_bucket: `eq.${UNKNOWN_RANK_BUCKET}` } as const;

/** Stops a function that ignores `offset` from being read forever; far above any real count of pairs. */
const MAX_PAGES = 200;

/**
 * Reads the pair counts through `public.read_hero_pairs(smallint[])`, summed over the modes asked
 * for. The function returns a set of rows, which PostgREST cuts at `max-rows`, so this pages
 * through it with `offset`, sorted by an explicit `order` instead of trusting the function's return
 * order, until a page comes back empty. Stopping on an empty page, not a short one, keeps it right
 * if the project's `max-rows` is ever set below the page size.
 */
export async function fetchHeroPairRows(
  env: SupabaseReadEnv,
  fetcher: typeof fetch = fetch,
  playModeIds: readonly number[] = HERO_PAIR_PLAY_MODE_IDS,
): Promise<HeroPairRow[]> {
  const rows: HeroPairRow[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const body = await callSupabaseFunction(
      'Hero pairs',
      READ_FUNCTION,
      { p_play_mode_ids: playModeIds },
      env,
      fetcher,
      { offset: rows.length, limit: PAGE_SIZE, order: PAGE_ORDER, filters: PAGE_FILTERS },
    );
    const received = parseHeroPairRows(body);

    if (received.length === 0) {
      return rows;
    }

    for (const row of received) {
      const key = [row.halfSeason, row.rankBucket, row.kind, row.gameHeroId, row.otherGameHeroId].join('|');

      // A row twice means the counts were rebuilt between two pages, so the pages do not fit together.
      if (seen.has(key)) {
        throw new Error(`${READ_FUNCTION}: the counts changed while they were being read; try again`);
      }

      seen.add(key);
      rows.push(row);
    }
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
