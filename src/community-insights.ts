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

/**
 * Shown buckets a dimension needs before any of them is shown. One or two buckets say little, and
 * with one hidden the missing one would be easy to work out from a total.
 */
export const INSIGHTS_MIN_SHOWN_BUCKETS = 3;

/**
 * One bucket as `read_community_insights()` returns it. The database has already added the
 * half-seasons whose own row passed its gates (matches, different players, no one player over a
 * share), so a bucket that failed is simply absent.
 */
export interface InsightsBucketRow {
  /** `weekday`, `time_of_day` or `session_position`; anything else is ignored. */
  dimension: string;
  bucket: number;
  matches: number;
  /** Matches with a win or a loss. */
  decidedMatches: number;
  wins: number;
}

export interface InsightsSource {
  sessionGapMinutes: number;
  minimumMatches: number;
  minimumRecorders: number;
  maxRecorderSharePercent: number;
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

interface Counts {
  matches: number;
  decidedMatches: number;
  wins: number;
}

/**
 * The tab's numbers. A null source (the aggregates do not exist yet) and an empty one give the same
 * answer: every bucket named, none shown.
 *
 * A dimension with fewer than `INSIGHTS_MIN_SHOWN_BUCKETS` shown buckets shows none, and a share is
 * the bucket's matches over the shown buckets' matches, never over a total that includes a hidden one.
 */
export function deriveCommunityInsights(source: InsightsSource | null): CommunityInsights {
  const rows = source?.buckets ?? [];
  const dimensions = DIMENSIONS.map((spec) => deriveDimension(spec, rows, source?.minimumMatches ?? 0));

  return {
    status: dimensions.some((dimension) => dimension.buckets.some((bucket) => bucket.status === 'ready'))
      ? 'ready'
      : 'not-enough-data',
    timeZone: 'UTC',
    sessionGapMinutes: source?.sessionGapMinutes ?? null,
    minimumMatches: source?.minimumMatches ?? null,
    minimumRecorders: source?.minimumRecorders ?? null,
    maxRecorderSharePercent: source?.maxRecorderSharePercent ?? null,
    dimensions,
  };
}

function deriveDimension(
  spec: DimensionSpec,
  rows: readonly InsightsBucketRow[],
  minimumDecidedMatches: number,
): CommunityInsightsDimension {
  const shown = new Map<number, Counts>();
  const known = new Set(spec.buckets.map(([bucket]) => bucket));

  for (const row of rows) {
    if (row.dimension !== spec.column || !known.has(row.bucket) || row.matches <= 0) {
      continue;
    }

    const total = shown.get(row.bucket) ?? { matches: 0, decidedMatches: 0, wins: 0 };
    total.matches += row.matches;
    total.decidedMatches += row.decidedMatches;
    total.wins += row.wins;
    shown.set(row.bucket, total);
  }

  const enough = shown.size >= INSIGHTS_MIN_SHOWN_BUCKETS;
  const shownMatches = [...shown.values()].reduce((sum, bucket) => sum + bucket.matches, 0);

  return {
    id: spec.id,
    title: spec.title,
    buckets: spec.buckets.map(([bucket, label]) =>
      toBucket(label, enough ? shown.get(bucket) : undefined, shownMatches, minimumDecidedMatches),
    ),
  };
}

function toBucket(
  label: string,
  counts: Counts | undefined,
  shownMatches: number,
  minimumDecidedMatches: number,
): CommunityInsightsBucket {
  if (!counts) {
    return { label, status: 'not-enough-data', matches: null, share: null, winRate: null };
  }

  return {
    label,
    status: 'ready',
    matches: counts.matches,
    share: percent(counts.matches, shownMatches),
    winRate:
      counts.decidedMatches > 0 && counts.decidedMatches >= minimumDecidedMatches
        ? percent(counts.wins, counts.decidedMatches)
        : null,
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
