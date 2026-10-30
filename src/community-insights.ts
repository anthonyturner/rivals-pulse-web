import type {
  CommunityInsights,
  CommunityInsightsBucket,
  CommunityInsightsDimension,
} from './contracts/community-insights.model.js';

/**
 * Every number on the Insights tab is derived here and nowhere else, from the counts in
 * `play_time_aggregates`. A bucket is the matches that started on a weekday, in a four-hour block
 * of the day (UTC), or at a place in a play session.
 */

/** Matches a bucket needs before it, or its win rate, is shown. */
export const INSIGHTS_MIN_MATCHES = 30;

/**
 * Players who recorded matches in a bucket before it is shown. With one or two uploaders a bucket
 * would be somebody's diary, not the community's.
 */
export const INSIGHTS_MIN_RECORDERS = 3;

/** One bucket of one half-season, as `read_community_insights()` returns it. */
export interface InsightsBucketRow {
  halfSeason: number;
  /** `weekday`, `time_of_day` or `session_position`; anything else is ignored. */
  dimension: string;
  bucket: number;
  matches: number;
  /** Matches with a win or a loss. */
  decidedMatches: number;
  wins: number;
  /** How many different players recorded these matches. Never a name or an id. */
  recorders: number;
}

export interface InsightsSource {
  sessionGapMinutes: number;
  buckets: readonly InsightsBucketRow[];
}

interface DimensionSpec {
  id: CommunityInsightsDimension['id'];
  /** The `dimension` value the database stores. */
  column: string;
  title: string;
  /** Bucket numbers and their labels, in display order. */
  buckets: readonly (readonly [number, string])[];
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** The bucket numbers match `play_time_aggregates`: ISO weekday 1 to 7, block 0 to 5, position 1 to 4. */
const DIMENSIONS: readonly DimensionSpec[] = [
  {
    id: 'weekday',
    column: 'weekday',
    title: 'Day of the week',
    buckets: WEEKDAYS.map((name, index) => [index + 1, name] as const),
  },
  {
    id: 'time-of-day',
    column: 'time_of_day',
    title: 'Time of day',
    buckets: [0, 1, 2, 3, 4, 5].map((block) => [block, blockLabel(block)] as const),
  },
  {
    id: 'session',
    column: 'session_position',
    title: 'Place in a play session',
    buckets: [
      [1, 'Match 1'],
      [2, 'Match 2'],
      [3, 'Match 3'],
      [4, 'Match 4 or later'],
    ],
  },
];

interface Pooled {
  matches: number;
  decidedMatches: number;
  wins: number;
  recorders: number;
}

/**
 * The tab's numbers. A null source (the aggregates cannot be read) and an empty one give the same
 * answer: every bucket named, none shown.
 *
 * Half-seasons are added together, because when people play does not depend on the patch. Recorders
 * are not: the same player can appear in two half-seasons and no identity is kept to tell, so the
 * largest single half-season count is used. It can only understate, which keeps a bucket hidden
 * rather than shown too early.
 */
export function deriveCommunityInsights(source: InsightsSource | null): CommunityInsights {
  const rows = source?.buckets ?? [];
  const dimensions = DIMENSIONS.map((spec) => deriveDimension(spec, rows));

  return {
    status: dimensions.some((dimension) => dimension.buckets.some((bucket) => bucket.status === 'ready'))
      ? 'ready'
      : 'not-enough-data',
    timeZone: 'UTC',
    sessionGapMinutes: source?.sessionGapMinutes ?? null,
    minimumMatches: INSIGHTS_MIN_MATCHES,
    minimumRecorders: INSIGHTS_MIN_RECORDERS,
    dimensions,
  };
}

function deriveDimension(spec: DimensionSpec, rows: readonly InsightsBucketRow[]): CommunityInsightsDimension {
  const pooled = new Map<number, Pooled>();
  const known = new Set(spec.buckets.map(([bucket]) => bucket));

  for (const row of rows) {
    if (row.dimension !== spec.column || !known.has(row.bucket)) {
      continue;
    }

    const total = pooled.get(row.bucket) ?? { matches: 0, decidedMatches: 0, wins: 0, recorders: 0 };
    total.matches += row.matches;
    total.decidedMatches += row.decidedMatches;
    total.wins += row.wins;
    total.recorders = Math.max(total.recorders, row.recorders);
    pooled.set(row.bucket, total);
  }

  const dimensionMatches = [...pooled.values()].reduce((sum, bucket) => sum + bucket.matches, 0);

  return {
    id: spec.id,
    title: spec.title,
    buckets: spec.buckets.map(([bucket, label]) => toBucket(label, pooled.get(bucket), dimensionMatches)),
  };
}

function toBucket(label: string, counts: Pooled | undefined, dimensionMatches: number): CommunityInsightsBucket {
  if (!counts || counts.matches < INSIGHTS_MIN_MATCHES || counts.recorders < INSIGHTS_MIN_RECORDERS) {
    return { label, status: 'not-enough-data', matches: null, share: null, winRate: null };
  }

  return {
    label,
    status: 'ready',
    matches: counts.matches,
    share: percent(counts.matches, dimensionMatches),
    winRate: counts.decidedMatches >= INSIGHTS_MIN_MATCHES ? percent(counts.wins, counts.decidedMatches) : null,
  };
}

/** A percentage from 0 to 100 with one decimal; the callers never pass a zero total. */
function percent(part: number, total: number): number {
  return Math.round((part / total) * 1000) / 10;
}

function blockLabel(block: number): string {
  const start = String(block * 4).padStart(2, '0');
  const end = String(block * 4 + 3).padStart(2, '0');

  return `${start}:00 to ${end}:59`;
}
