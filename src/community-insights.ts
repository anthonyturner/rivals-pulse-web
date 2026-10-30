import type {
  CommunityInsights,
  CommunityInsightsBucket,
  CommunityInsightsDimension,
} from './contracts/community-insights.model.js';

/**
 * Every label and shape on the Insights tab is made here, from the shares and win rates that
 * `read_community_insights()` returns. A bucket is the matches that started on a weekday, in a
 * four-hour block of the day (UTC), or at a place in a play session.
 *
 * The database decides what may be shown (gates per half-season, a dimension with enough shown
 * buckets, shares over the shown buckets) and sends no counts, so a bucket it left out is simply
 * absent and nothing here can add up to it.
 */

/** One shown bucket as the function returns it: whole percentages, no counts. */
export interface InsightsBucketRow {
  /** `weekday`, `time_of_day` or `session_position`; anything else is ignored. */
  dimension: string;
  bucket: number;
  sharePercent: number;
  /** Null when too few of the bucket's matches had a win or a loss. */
  winRatePercent: number | null;
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

/**
 * The tab's numbers. A null source (the aggregates do not exist yet) and an empty one give the same
 * answer: every bucket named, none shown.
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
    minimumMatches: source?.minimumMatches ?? null,
    minimumRecorders: source?.minimumRecorders ?? null,
    maxRecorderSharePercent: source?.maxRecorderSharePercent ?? null,
    dimensions,
  };
}

function deriveDimension(spec: DimensionSpec, rows: readonly InsightsBucketRow[]): CommunityInsightsDimension {
  return {
    id: spec.id,
    title: spec.title,
    buckets: spec.buckets.map(([bucket, label]): CommunityInsightsBucket => {
      const shown = rows.find((row) => row.dimension === spec.column && row.bucket === bucket);

      return shown
        ? { label, status: 'ready', share: shown.sharePercent, winRate: shown.winRatePercent }
        : { label, status: 'not-enough-data', share: null, winRate: null };
    }),
  };
}

function blockLabel(block: number): string {
  const start = String(block * 4).padStart(2, '0');
  const end = String(block * 4 + 3).padStart(2, '0');

  return `${start}:00 to ${end}:59`;
}
