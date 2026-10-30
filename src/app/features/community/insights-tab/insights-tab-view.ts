import type { CommunityInsights } from '../../../../contracts/community-insights.model';

export interface InsightsRowView {
  label: string;
  ready: boolean;
  /** Empty when the row is not ready. */
  matches: string;
  winRate: string;
  /** The row's volume as a percentage of the dimension's largest shown row. */
  barPercent: number;
}

export interface InsightsDimensionView {
  id: string;
  title: string;
  rows: InsightsRowView[];
}

export type InsightsTabView =
  | { kind: 'loading' }
  | { kind: 'not-enough-data' }
  | { kind: 'ready'; notes: string[]; dimensions: InsightsDimensionView[] };

/** `undefined` is still loading; `null` is an answer that could not be read, shown as the empty state. */
export function buildInsightsTabView(insights: CommunityInsights | null | undefined): InsightsTabView {
  if (insights === undefined) {
    return { kind: 'loading' };
  }

  if (insights === null || insights.status === 'not-enough-data') {
    return { kind: 'not-enough-data' };
  }

  const notes = [
    `All days and times are ${insights.timeZone}.`,
    ...(insights.sessionGapMinutes === null
      ? []
      : [`A play session ends after ${insights.sessionGapMinutes} minutes without a match.`]),
    `A row appears once at least ${insights.minimumMatches} matches from at least ${insights.minimumRecorders} players are behind it.`,
  ];

  return {
    kind: 'ready',
    notes,
    dimensions: insights.dimensions.map((dimension) => {
      const largest = Math.max(0, ...dimension.buckets.map((bucket) => bucket.share ?? 0));

      return {
        id: dimension.id,
        title: dimension.title,
        rows: dimension.buckets.map((bucket): InsightsRowView => {
          if (bucket.status !== 'ready' || bucket.matches === null) {
            return { label: bucket.label, ready: false, matches: '', winRate: '', barPercent: 0 };
          }

          return {
            label: bucket.label,
            ready: true,
            matches: bucket.matches.toLocaleString('en-US'),
            winRate: bucket.winRate === null ? 'Not enough results' : `${bucket.winRate.toFixed(1)}%`,
            barPercent: largest > 0 ? Math.round(((bucket.share ?? 0) / largest) * 100) : 0,
          };
        }),
      };
    }),
  };
}
