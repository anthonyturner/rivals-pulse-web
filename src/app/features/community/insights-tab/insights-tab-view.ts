import type { CommunityInsights } from '../../../../contracts/community-insights.model';

export interface InsightsRowView {
  label: string;
  ready: boolean;
  /** Empty when the row is not ready. */
  share: string;
  winRate: string;
  /** The row's share as a percentage of the dimension's largest shown row, for the bar. */
  barPercent: number;
}

export interface InsightsDimensionView {
  id: string;
  title: string;
  rows: InsightsRowView[];
}

export type InsightsTabView =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'not-enough-data' }
  | { kind: 'ready'; notes: string[]; dimensions: InsightsDimensionView[] };

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

  const notes = [
    `All days and times are ${insights.timeZone}.`,
    ...(insights.sessionGapMinutes === null
      ? []
      : [`A play session ends after ${insights.sessionGapMinutes} minutes without a match.`]),
    ...gateNotes(insights),
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
          if (bucket.status !== 'ready' || bucket.share === null) {
            return { label: bucket.label, ready: false, share: '', winRate: '', barPercent: 0 };
          }

          return {
            label: bucket.label,
            ready: true,
            share: `${bucket.share}%`,
            winRate: bucket.winRate === null ? 'Not enough results' : `${bucket.winRate}%`,
            barPercent: largest > 0 ? Math.round((bucket.share / largest) * 100) : 0,
          };
        }),
      };
    }),
  };
}

function gateNotes(insights: CommunityInsights): string[] {
  const { minimumMatches, minimumRecorders, maxRecorderSharePercent } = insights;

  if (minimumMatches === null || minimumRecorders === null || maxRecorderSharePercent === null) {
    return [];
  }

  return [
    `A row appears once at least ${minimumMatches} matches from at least ${minimumRecorders} players are behind it in a half-season, and no one player recorded more than ${maxRecorderSharePercent}% of them. Shares are of the rows shown.`,
  ];
}
