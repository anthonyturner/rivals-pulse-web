import { TEAM_LINEUP_DEFAULT_MODE_ID, type TeamLineupShape, type TeamLineups } from '../../../contracts/team-lineups.model.ts';
import {
  chooseHalfSeason,
  halfSeasonTimeline,
  modesOf,
  playModeFromQuery,
  type HeroStatsSource,
} from '../stats/hero-stats.ts';

/**
 * Every team line-up figure on the site is derived here, from the counts in `team_lineup_shapes` and
 * `triple_support_totals` as `read_team_lineup_shapes()` returns them.
 */

/**
 * Teams a shape needs in a half-season before its figures are shown. Keep it equal to
 * `public.team_lineup_min_teams()`, which the database applies first (it withholds the wins of a
 * thinner shape); applying it again here keeps a thinner shape's figures out if that function changes.
 */
export const TEAM_LINEUP_MIN_TEAMS = 50;

/**
 * `rank_bucket` of rows with no rank: every row today. Once buckets of 0 or more exist, -1 means
 * "unknown rank", not "all ranks", so the figures are built from these rows alone and never by
 * adding buckets together (a bucket the database hid for too few recorders would be inside the sum).
 */
export const UNKNOWN_RANK_BUCKET = -1;

interface ShapeCounts {
  vanguards: number;
  duelists: number;
  strategists: number;
}

/**
 * One shape in one half-season and rank bucket, summed over the modes asked for, as
 * `read_team_lineup_shapes()` returns it. The team counts are the half-season's, repeated on every
 * row. A half-season with only unclassified teams has one row with no shape.
 */
export interface TeamLineupRow {
  halfSeason: number;
  rankBucket: number;
  shape: ShapeCounts | null;
  /** Null only when the database reports no team count; for a shape under its minimum it is the count so far, and its wins are withheld. */
  teams: number | null;
  wins: number | null;
  enoughData: boolean;
  classifiedTeams: number;
  unclassifiedTeams: number;
}

interface HalfSeasonSnapshot {
  shapes: TeamLineupShape[];
  classifiedTeams: number;
  unclassifiedTeams: number;
  ready: boolean;
}

interface DeriveTeamLineupsOptions {
  now: Date;
  /**
   * Derive exactly this half-season, with no fall-back to the previous one. A half-season that has
   * not started, or that nothing knows, gives the empty state.
   */
  halfSeason?: number;
  /**
   * The `mode` query value that the rows were read for; see `playModeFromQuery`. None is
   * Competitive, and a value naming no mode counts nothing.
   */
  mode?: string;
}

export function deriveTeamLineups(
  rows: readonly TeamLineupRow[],
  source: Pick<HeroStatsSource, 'halfSeasons' | 'totals'>,
  options: DeriveTeamLineupsOptions,
): TeamLineups {
  const timeline = halfSeasonTimeline(source.halfSeasons, rows.map((row) => row.halfSeason), options.now);
  const mode = playModeFromQuery(options.mode, TEAM_LINEUP_DEFAULT_MODE_ID);
  const snapshots = new Map<number, HalfSeasonSnapshot>();
  const snapshot = (id: number): HalfSeasonSnapshot => {
    let result = snapshots.get(id);

    if (result === undefined) {
      result = snapshotOf(rows, id);
      snapshots.set(id, result);
    }

    return result;
  };
  const { shown, inPlaceOf } = chooseHalfSeason(timeline, options.halfSeason, (id) => snapshot(id).ready);
  const counted = shown === undefined ? undefined : snapshot(shown);

  return {
    status: counted?.ready ? 'ready' : 'not-enough-data',
    minimumTeams: TEAM_LINEUP_MIN_TEAMS,
    halfSeason: shown === undefined ? null : timeline.describe(shown),
    inPlaceOf: inPlaceOf === undefined ? null : timeline.describe(inPlaceOf),
    halfSeasons: timeline.started.map(timeline.describe),
    mode: mode?.id ?? null,
    modes: modesOf(source, shown),
    classifiedTeams: counted?.classifiedTeams ?? 0,
    unclassifiedTeams: counted?.unclassifiedTeams ?? 0,
    shapes: counted?.shapes ?? [],
  };
}

function snapshotOf(rows: readonly TeamLineupRow[], halfSeason: number): HalfSeasonSnapshot {
  const own = rows.filter((row) => row.halfSeason === halfSeason && row.rankBucket === UNKNOWN_RANK_BUCKET);
  const shapes = own.flatMap((row) => (row.shape === null ? [] : [shapeOf(row, row.shape)]));

  shapes.sort(
    (a, b) =>
      Number(b.status === 'ready') - Number(a.status === 'ready') ||
      (b.teams ?? 0) - (a.teams ?? 0) ||
      a.shape.localeCompare(b.shape),
  );

  return {
    shapes,
    // Every row of a half-season carries the same team counts.
    classifiedTeams: own[0]?.classifiedTeams ?? 0,
    unclassifiedTeams: own[0]?.unclassifiedTeams ?? 0,
    ready: shapes.some((shape) => shape.status === 'ready'),
  };
}

function shapeOf(row: TeamLineupRow, counts: ShapeCounts): TeamLineupShape {
  const { vanguards, duelists, strategists } = counts;
  const shape = `${vanguards}-${duelists}-${strategists}`;
  const { teams, wins } = row;

  if (!row.enoughData || teams === null || wins === null || teams < TEAM_LINEUP_MIN_TEAMS) {
    // The count so far is released so a reader can show progress; the wins stay out.
    return {
      shape,
      vanguards,
      duelists,
      strategists,
      status: 'not-enough-data',
      teams: teams !== null && teams < TEAM_LINEUP_MIN_TEAMS ? teams : null,
      wins: null,
      pickRate: null,
      winRate: null,
    };
  }

  return {
    shape,
    vanguards,
    duelists,
    strategists,
    status: 'ready',
    teams,
    wins,
    pickRate: ratio(teams, row.classifiedTeams),
    winRate: ratio(wins, teams),
  };
}

/** To four decimals; 0 when there is nothing to divide by. */
function ratio(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 10_000) / 10_000 : 0;
}
