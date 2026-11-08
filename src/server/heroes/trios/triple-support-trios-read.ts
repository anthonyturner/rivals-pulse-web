import type { TripleSupportTrios } from '../../../contracts/triple-support-trios.model.ts';
import { heroSlugByGameId, listHeroNames, strategistTagByGameId } from '../catalog/index.ts';
import { playModeFromQuery } from '../stats/hero-stats.ts';
import { readHeroStatsSource } from '../stats/index.ts';
import {
  deriveTripleSupportTrios,
  TRIPLE_SUPPORT_PLAY_MODE_IDS,
  UNKNOWN_RANK_BUCKET,
  type TripleSupportRow,
} from './triple-support-trios.ts';
import {
  answerReader,
  callSupabaseFunction,
  getSupabaseClient,
  orWhenNotDeployed,
  type SupabaseReadEnv,
} from '../../supabase/index.ts';

interface TripleSupportTriosReadOptions {
  env?: SupabaseReadEnv;
  fetch?: typeof fetch;
  now?: () => Date;
  /** One exact half-season instead of the current one; see `DeriveTripleSupportTriosOptions`. */
  halfSeason?: number;
  /** The `mode` query value, as `DeriveTripleSupportTriosOptions` takes it. */
  mode?: string;
  /** Each hero's display name by slug; reads `hero_content` unless given. */
  loadHeroNames?: () => Promise<ReadonlyMap<string, string>>;
}

const READ_FUNCTION = 'read_triple_support_trios';
const { recordsOf, numberOf } = answerReader(READ_FUNCTION);

/** PostgREST's `max-rows` on Supabase: a page of this many rows may be cut short. */
const PAGE_SIZE = 1000;

/** Every row is unique on these columns, so sorting by them makes a range cut the same way on every page. */
const PAGE_ORDER = ['half_season', 'rank_bucket', 'hero_a', 'hero_b', 'hero_c'] as const;

/** Only the rows the figures are built from, so the database never has to send the others. */
const PAGE_FILTERS = { rank_bucket: `eq.${UNKNOWN_RANK_BUCKET}` } as const;

/** Stops a function that ignores `offset` from being read forever; far above any real count of trios. */
const MAX_PAGES = 200;

/**
 * Reads the trio counts through `public.read_triple_support_trios(smallint[])`, summed over the modes
 * asked for. The function returns a set of rows, which PostgREST cuts at `max-rows`, so this pages
 * through it with `offset`, sorted by an explicit `order`, until a page comes back empty (not short,
 * which stays right if the project's `max-rows` is ever set below the page size).
 */
export async function fetchTripleSupportRows(
  env: SupabaseReadEnv,
  fetcher: typeof fetch = fetch,
  playModeIds: readonly number[] = TRIPLE_SUPPORT_PLAY_MODE_IDS,
): Promise<TripleSupportRow[]> {
  const rows: TripleSupportRow[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const body = await callSupabaseFunction(
      'Triple support trios',
      READ_FUNCTION,
      { p_play_mode_ids: playModeIds },
      env,
      fetcher,
      { offset: rows.length, limit: PAGE_SIZE, order: PAGE_ORDER, filters: PAGE_FILTERS },
    );
    const received = parseTripleSupportRows(body);

    if (received.length === 0) {
      return rows;
    }

    for (const row of received) {
      const key = [row.halfSeason, row.rankBucket, row.heroA, row.heroB, row.heroC].join('|');

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

/** Picks the known fields out of the function's answer and rejects anything that is not a number. */
export function parseTripleSupportRows(body: unknown): TripleSupportRow[] {
  return recordsOf(body, 'the answer').map(
    (row): TripleSupportRow => ({
      halfSeason: numberOf(row, 'half_season'),
      rankBucket: numberOf(row, 'rank_bucket'),
      heroA: numberOf(row, 'hero_a'),
      heroB: numberOf(row, 'hero_b'),
      heroC: numberOf(row, 'hero_c'),
      matches: numberOf(row, 'matches'),
      teams: numberOf(row, 'teams'),
      wins: numberOf(row, 'wins'),
      classifiedTeams: numberOf(row, 'classified_teams'),
      unclassifiedTeams: numberOf(row, 'unclassified_teams'),
      fourPlusTeams: numberOf(row, 'four_plus_teams'),
    }),
  );
}

/** Game hero id to display name, through the hero's slug. */
function namesByGameId(nameBySlug: ReadonlyMap<string, string>): ReadonlyMap<number, string> {
  return new Map(
    [...heroSlugByGameId].flatMap(([gameId, slug]): [number, string][] => {
      const name = nameBySlug.get(slug);

      return name === undefined ? [] : [[gameId, name]];
    }),
  );
}

/**
 * The site's triple-support trios. A trio with a Strategist that has no tag, or a utility hero with no
 * name, is left out and logged; it never fails the request. The half-seasons come from the same
 * `read_hero_stats()` answer the hero stats use, so both read the same current half-season. A read
 * function that is not in the database yet is the empty state, and so is a `mode` that names no
 * mode: nothing is read for it.
 */
export async function getTripleSupportTrios(options: TripleSupportTriosReadOptions = {}): Promise<TripleSupportTrios> {
  const env = options.env ?? process.env;
  const mode = playModeFromQuery(options.mode);
  const [rows, source] = await Promise.all([
    mode === undefined
      ? []
      : orWhenNotDeployed(fetchTripleSupportRows(env, options.fetch, mode.playModeIds), READ_FUNCTION, []),
    readHeroStatsSource(env, options.fetch),
  ]);
  const nameBySlug =
    rows.length === 0
      ? new Map<string, string>()
      : await (options.loadHeroNames ?? (() => listHeroNames(getSupabaseClient())))();
  const { trios, unnamedGameIds } = deriveTripleSupportTrios(rows, source, {
    now: (options.now ?? (() => new Date()))(),
    halfSeason: options.halfSeason,
    mode: options.mode,
    tagByGameId: strategistTagByGameId,
    nameByGameId: namesByGameId(nameBySlug),
    slugByGameId: heroSlugByGameId,
  });

  if (unnamedGameIds.length > 0) {
    console.warn(
      `Triple support left out trios with a hero that cannot be named (no tag in strategist-tags.json, no entry in hero-game-ids.json, or a utility hero with no name): ${unnamedGameIds.join(', ')}`,
    );
  }

  return trios;
}
