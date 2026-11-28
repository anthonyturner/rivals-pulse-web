import type { CommunityInsights, CommunityInsightsBucket, CommunityInsightsDimension } from '../../../../contracts/community-insights.model';
import { sideOfFifty } from '../../../shared/utilities/stat-labels';
import { axisWindow, positionOf } from '../../../shared/components/chart/chart-geometry';
import type { ChartColumn, ChartLane } from '../../../shared/components/chart/column-chart/column-chart.component';

export interface InsightsDimensionView {
  id: string;
  title: string;
  /** Names the chart: the caption of its data table. */
  caption: string;
  /** Share of matches as bars, then win rate as dots. */
  lanes: ChartLane[];
  /** One column per bucket, shown or not: a bucket that is not shown has no figure to draw. */
  columns: ChartColumn[];
  /** Whether each mark can print its figure over itself without the columns running into one another. */
  showValues: boolean;
}

export type InsightsTabView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'not-enough-data' }
  | { kind: 'ready'; /** How the figures are counted, as sentences. */ note: string; dimensions: InsightsDimensionView[] };

/**
 * `undefined` is still loading; `null` is a request that failed or an answer that could not be read,
 * which is an outage and not "no data yet", so it is told apart from the designed empty state.
 */
export function buildInsightsTabView(insights: CommunityInsights | null | undefined): InsightsTabView {
  if (insights === undefined) {
    return { kind: 'loading' };
  }

  if (insights === null) {
    return { kind: 'unavailable' };
  }

  if (insights.status === 'not-enough-data') {
    return { kind: 'not-enough-data' };
  }

  const note = [
    `All days and times are ${insights.timeZone}.`,
    ...(insights.sessionGapMinutes === null
      ? []
      : [`A play session ends after ${insights.sessionGapMinutes} minutes without a match.`]),
    ...gateNotes(insights),
  ].join(' ');

  return {
    kind: 'ready',
    note,
    dimensions: insights.dimensions.map(dimensionView),
  };
}

/** More columns than this are too many to print a figure over each mark. */
const VALUES_LIMIT = 7;

/** Win rates sit close to 50%, so the dots get a window around the data and the 50% line, not the whole 0 to 100. */
const WIN_RATE_WINDOW = { anchor: 50, pad: 2, step: 5, minSpan: 10, floor: 0, ceiling: 100 } as const;

function dimensionView(dimension: CommunityInsightsDimension): InsightsDimensionView {
  const shown = dimension.buckets.filter(isShown);
  const largest = Math.max(0, ...shown.map((bucket) => bucket.share));
  const window = axisWindow(
    shown.flatMap((bucket) => (bucket.winRate === null ? [] : [bucket.winRate])),
    WIN_RATE_WINDOW,
  );

  return {
    id: dimension.id,
    title: dimension.title,
    caption: `${dimension.title}: share of matches and win rate`,
    showValues: dimension.buckets.length <= VALUES_LIMIT,
    lanes: [
      { name: 'Share of matches', kind: 'bars', tone: 'primary' },
      {
        name: 'Win rate',
        kind: 'dots',
        note: `Scale ${window.min}% to ${window.max}%`,
        guide: { position: positionOf(50, window.min, window.max), label: '50%' },
      },
    ],
    columns: dimension.buckets.map((bucket): ChartColumn => {
      const label = bucket.label;
      const shortLabel = shortBucketLabel(dimension.id, label);

      if (!isShown(bucket)) {
        return { label, shortLabel, cells: [null, null] };
      }

      return {
        label,
        shortLabel,
        cells: [
          { position: largest > 0 ? (bucket.share / largest) * 100 : 0, valueLabel: `${bucket.share}%` },
          bucket.winRate === null
            ? { position: null, valueLabel: 'Not enough results' }
            : {
                position: positionOf(bucket.winRate, window.min, window.max),
                valueLabel: `${bucket.winRate}%`,
                side: sideOfFifty(bucket.winRate),
              },
        ],
      };
    }),
  };
}

function isShown(bucket: CommunityInsightsBucket): bucket is CommunityInsightsBucket & { status: 'ready'; share: number } {
  return bucket.status === 'ready' && bucket.share !== null;
}

/** What the axis shows under a narrow column: "Mon", "00-04" for a four-hour block, "4+" for the fourth match or later. The full label stays in the tooltip and the table. */
function shortBucketLabel(dimension: CommunityInsightsDimension['id'], label: string): string {
  if (dimension === 'weekday') {
    return label.slice(0, 3);
  }

  if (dimension === 'time-of-day') {
    const block = /^(\d\d):\d\d to (\d\d):\d\d$/.exec(label);

    return block === null ? label : `${block[1]}-${String(Number(block[2]) + 1).padStart(2, '0')}`;
  }

  const place = /^Match (\d+)( or later)?$/.exec(label);

  return place === null ? label : `${place[1]}${place[2] === undefined ? '' : '+'}`;
}

function gateNotes(insights: CommunityInsights): string[] {
  const { minimumMatches } = insights;

  if (minimumMatches === null) {
    return [];
  }

  return [
    `A row appears once at least ${minimumMatches} matches are behind it in a half-season. Shares are of the rows shown.`,
    'While few players upload, these totals can come from one player.',
  ];
}
