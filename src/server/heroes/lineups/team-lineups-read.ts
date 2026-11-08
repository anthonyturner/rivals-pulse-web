import type { TeamLineups } from '../../../contracts/team-lineups.model.ts';
import { playModeFromQuery } from '../stats/hero-stats.ts';
import { readHeroStatsSource } from '../stats/index.ts';
import {
  deriveTeamLineups,
  TEAM_LINEUP_DEFAULT_MODE_ID,
  UNKNOWN_RANK_BUCKET,
  type TeamLineupRow,
} from './team-lineups.ts';
import {
  answerReader,
  callSupabaseFunction,
  orWhenNotDeployed,
  type SupabaseReadEnv,
} from '../../supabase/index.ts';

interface TeamLineupsReadOptions {
  env?: SupabaseReadEnv;
  fetch?: typeof fetch;
  now?: () => Date;
  /** One exact half-season instead of the current one; see `DeriveTeamLineupsOptions`. */
  halfSeason?: number;
  /** The `mode` query value, as `DeriveTeamLineupsOptions` takes it. */
  mode?: string;
}

const READ_FUNCTION = 'read_team_lineup_shapes';
const { recordsOf, numberOf, nullableNumberOf, booleanOf } = answerReader(READ_FUNCTION);

/**
 * PostgREST's `max-rows` on Supabase. A half-season has a few dozen shapes at most (a shape is three
 * counts that add up to a team's size), so a full page means the answer may be cut short; that is
 * reported instead of being read as the whole answer.
 */
const PAGE_SIZE = 1000;

/** Only the rows the figures are built from, so the database never has to send the others. */
const PAGE_FILTERS = { rank_bucket: `eq.${UNKNOWN_RANK_BUCKET}` } as const;

/** Reads the shape counts through `public.read_team_lineup_shapes(smallint[])`, summed over `playModeIds`. */
export async function fetchTeamLineupRows(
  env: SupabaseReadEnv,
  fetcher: typeof fetch = fetch,
  playModeIds: readonly number[],
): Promise<TeamLineupRow[]> {
  const body = await callSupabaseFunction(
    'Team line-ups',
    READ_FUNCTION,
    { p_play_mode_ids: playModeIds },
    env,
    fetcher,
    { offset: 0, limit: PAGE_SIZE, filters: PAGE_FILTERS },
  );
  const rows = parseTeamLineupRows(body);

  if (rows.length >= PAGE_SIZE) {
    throw new Error(`${READ_FUNCTION}: ${rows.length} rows is more than a page; the answer may be cut short`);
  }

  return rows;
}

/** Picks the known fields out of the function's answer and rejects anything that is not the expected type. */
export function parseTeamLineupRows(body: unknown): TeamLineupRow[] {
  return recordsOf(body, 'the answer').map((row): TeamLineupRow => {
    const vanguards = nullableNumberOf(row, 'vanguards');
    const duelists = nullableNumberOf(row, 'duelists');
    const strategists = nullableNumberOf(row, 'strategists');

    return {
      halfSeason: numberOf(row, 'half_season'),
      rankBucket: numberOf(row, 'rank_bucket'),
      shape:
        vanguards === null || duelists === null || strategists === null ? null : { vanguards, duelists, strategists },
      teams: nullableNumberOf(row, 'teams'),
      wins: nullableNumberOf(row, 'wins'),
      enoughData: booleanOf(row, 'enough_data'),
      classifiedTeams: numberOf(row, 'classified_teams'),
      unclassifiedTeams: numberOf(row, 'unclassified_teams'),
    };
  });
}

/**
 * The site's team line-ups, in Competitive unless a `mode` is asked for. The half-seasons come from
 * the same `read_hero_stats()` answer the hero stats use, so both read the same current half-season.
 * A read function that is not in the database yet is the empty state, and so is a `mode` that names
 * no mode: nothing is read for it.
 */
export async function getTeamLineups(options: TeamLineupsReadOptions = {}): Promise<TeamLineups> {
  const env = options.env ?? process.env;
  const mode = playModeFromQuery(options.mode, TEAM_LINEUP_DEFAULT_MODE_ID);
  const [rows, source] = await Promise.all([
    mode === undefined
      ? []
      : orWhenNotDeployed(fetchTeamLineupRows(env, options.fetch, mode.playModeIds), READ_FUNCTION, []),
    readHeroStatsSource(env, options.fetch),
  ]);

  return deriveTeamLineups(rows, source, {
    now: (options.now ?? (() => new Date()))(),
    halfSeason: options.halfSeason,
    mode: options.mode,
  });
}
