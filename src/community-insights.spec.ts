import type { CommunityInsights } from './contracts/community-insights.model.js';
import { deriveCommunityInsights, type InsightsBucketRow } from './community-insights.js';

function row(overrides: Partial<InsightsBucketRow>): InsightsBucketRow {
  return { dimension: 'weekday', bucket: 1, sharePercent: 33, winRatePercent: 50, ...overrides };
}

function derive(buckets: InsightsBucketRow[]): CommunityInsights {
  return deriveCommunityInsights({
    sessionGapMinutes: 30,
    minimumMatches: 30,
    minimumRecorders: 3,
    maxRecorderSharePercent: 50,
    buckets,
  });
}

function dimension(insights: CommunityInsights, id: string) {
  const found = insights.dimensions.find((candidate) => candidate.id === id);

  if (!found) {
    throw new Error(`no ${id} dimension`);
  }

  return found;
}

const NOT_ENOUGH = { status: 'not-enough-data', share: null, winRate: null } as const;

describe('deriveCommunityInsights', () => {
  it('names every bucket of every dimension, all not enough data, when nothing is shown', () => {
    const insights = derive([]);

    expect(insights.status).toBe('not-enough-data');
    expect(insights.timeZone).toBe('UTC');
    expect(insights.dimensions.map((d) => [d.id, d.buckets.length])).toEqual([
      ['weekday', 7],
      ['time-of-day', 6],
      ['session', 4],
    ]);
    expect(dimension(insights, 'weekday').buckets.map((b) => b.label)).toEqual([
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
    expect(dimension(insights, 'time-of-day').buckets.map((b) => b.label)).toEqual([
      '00:00 to 03:59',
      '04:00 to 07:59',
      '08:00 to 11:59',
      '12:00 to 15:59',
      '16:00 to 19:59',
      '20:00 to 23:59',
    ]);
    expect(dimension(insights, 'session').buckets.map((b) => b.label)).toEqual([
      'Match 1',
      'Match 2',
      'Match 3',
      'Match 4 or later',
    ]);
    for (const bucket of insights.dimensions.flatMap((d) => d.buckets)) {
      expect(bucket).toEqual({ label: bucket.label, ...NOT_ENOUGH });
    }
  });

  it('carries the gates and the session gap the database used, and null for each when there is no answer', () => {
    const known = derive([]);
    expect([known.sessionGapMinutes, known.minimumMatches, known.minimumRecorders, known.maxRecorderSharePercent]).toEqual([
      30, 30, 3, 50,
    ]);

    const unknown = deriveCommunityInsights(null);
    expect(unknown.status).toBe('not-enough-data');
    expect([unknown.sessionGapMinutes, unknown.minimumMatches, unknown.minimumRecorders, unknown.maxRecorderSharePercent]).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  it('shows exactly the buckets the database sent, with their share and win rate, and no others', () => {
    const insights = derive([
      row({ bucket: 1, sharePercent: 50, winRatePercent: 60 }),
      row({ bucket: 2, sharePercent: 30, winRatePercent: null }),
      row({ bucket: 4, sharePercent: 20, winRatePercent: 45 }),
    ]);

    expect(insights.status).toBe('ready');
    expect(dimension(insights, 'weekday').buckets.slice(0, 5)).toEqual([
      { label: 'Monday', status: 'ready', share: 50, winRate: 60 },
      { label: 'Tuesday', status: 'ready', share: 30, winRate: null },
      { label: 'Wednesday', ...NOT_ENOUGH },
      { label: 'Thursday', status: 'ready', share: 20, winRate: 45 },
      { label: 'Friday', ...NOT_ENOUGH },
    ]);
  });

  it('places time-of-day blocks and session positions by their bucket number', () => {
    const insights = derive([
      row({ dimension: 'session_position', bucket: 4 }),
      row({ dimension: 'time_of_day', bucket: 5 }),
    ]);

    expect(dimension(insights, 'session').buckets.map((b) => b.status)).toEqual([
      'not-enough-data',
      'not-enough-data',
      'not-enough-data',
      'ready',
    ]);
    expect(dimension(insights, 'time-of-day').buckets[5]).toEqual(
      jasmine.objectContaining({ label: '20:00 to 23:59', status: 'ready' }),
    );
  });

  it('ignores a dimension it does not know and a bucket number outside its dimension', () => {
    const insights = derive([
      row({ dimension: 'hero', bucket: 1 }),
      row({ bucket: 0 }),
      row({ bucket: 8 }),
      row({ dimension: 'time_of_day', bucket: 6 }),
      row({ dimension: 'session_position', bucket: 5 }),
    ]);

    expect(insights.status).toBe('not-enough-data');
  });

  it('publishes only labels, a status, a share and a win rate per bucket, and never a count', () => {
    const insights = derive([row({ bucket: 1 }), row({ bucket: 2 }), row({ bucket: 3 })]);

    for (const bucket of insights.dimensions.flatMap((d) => d.buckets)) {
      expect(Object.keys(bucket).sort()).toEqual(['label', 'share', 'status', 'winRate']);
    }
    for (const group of insights.dimensions) {
      expect(Object.keys(group).sort()).toEqual(['buckets', 'id', 'title']);
    }
    expect(Object.keys(insights).sort()).toEqual([
      'dimensions',
      'maxRecorderSharePercent',
      'minimumMatches',
      'minimumRecorders',
      'sessionGapMinutes',
      'status',
      'timeZone',
    ]);
  });
});
