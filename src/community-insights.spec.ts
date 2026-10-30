import type { CommunityInsights } from './contracts/community-insights.model.js';
import {
  deriveCommunityInsights,
  INSIGHTS_MIN_SHOWN_BUCKETS,
  type InsightsBucketRow,
} from './community-insights.js';

function row(overrides: Partial<InsightsBucketRow>): InsightsBucketRow {
  return { dimension: 'weekday', bucket: 1, matches: 40, decidedMatches: 40, wins: 20, ...overrides };
}

/** Enough shown weekday buckets for the dimension to appear, with `first` replacing the Monday one. */
function weekdays(first: Partial<InsightsBucketRow> = {}, count = INSIGHTS_MIN_SHOWN_BUCKETS): InsightsBucketRow[] {
  return Array.from({ length: count }, (_, index) =>
    row({ bucket: index + 1, ...(index === 0 ? first : {}) }),
  );
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

const NOT_ENOUGH = { status: 'not-enough-data', matches: null, share: null, winRate: null } as const;

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

  it('shows the buckets of a dimension that has enough of them, with volume and win rate', () => {
    const insights = derive(weekdays({ matches: 40, decidedMatches: 40, wins: 24 }));

    expect(insights.status).toBe('ready');
    expect(dimension(insights, 'weekday').buckets.slice(0, 4)).toEqual([
      { label: 'Monday', status: 'ready', matches: 40, share: 33.3, winRate: 60 },
      { label: 'Tuesday', status: 'ready', matches: 40, share: 33.3, winRate: 50 },
      { label: 'Wednesday', status: 'ready', matches: 40, share: 33.3, winRate: 50 },
      { label: 'Thursday', ...NOT_ENOUGH },
    ]);
  });

  it('shows nothing of a dimension with too few shown buckets, however large they are', () => {
    const insights = derive(weekdays({ matches: 900, decidedMatches: 900 }, INSIGHTS_MIN_SHOWN_BUCKETS - 1));

    expect(insights.status).toBe('not-enough-data');
    expect(dimension(insights, 'weekday').buckets.every((b) => b.status === 'not-enough-data')).toBeTrue();
  });

  it('is the empty state when no dimension has enough shown buckets, even if some buckets came through', () => {
    const insights = derive([
      ...weekdays({}, 2),
      row({ dimension: 'session_position', bucket: 1 }),
      row({ dimension: 'time_of_day', bucket: 0 }),
    ]);

    expect(insights.status).toBe('not-enough-data');
  });

  it('takes shares over the shown buckets only, so no figure adds up to a hidden bucket', () => {
    const insights = derive([
      row({ bucket: 1, matches: 60 }),
      row({ bucket: 2, matches: 30 }),
      row({ bucket: 3, matches: 10 }),
    ]);
    const shares = dimension(insights, 'weekday').buckets.map((b) => b.share);

    expect(shares.slice(0, 3)).toEqual([60, 30, 10]);
    expect(shares.slice(3).every((share) => share === null)).toBeTrue();
    expect(shares.reduce<number>((sum, share) => sum + (share ?? 0), 0)).toBe(100);
  });

  it('shows the volume but no win rate when too few matches have a win or a loss', () => {
    const insights = derive(weekdays({ matches: 60, decidedMatches: 29, wins: 10 }));

    expect(dimension(insights, 'weekday').buckets[0]).toEqual({
      label: 'Monday',
      status: 'ready',
      matches: 60,
      share: 42.9,
      winRate: null,
    });
  });

  it('rounds a win rate to one decimal', () => {
    const insights = derive(weekdays({ matches: 33, decidedMatches: 33, wins: 20 }));

    expect(dimension(insights, 'weekday').buckets[0].winRate).toBe(60.6);
  });

  it('places time-of-day blocks and session positions by their bucket number', () => {
    const insights = derive([
      row({ dimension: 'session_position', bucket: 2 }),
      row({ dimension: 'session_position', bucket: 3 }),
      row({ dimension: 'session_position', bucket: 4 }),
      row({ dimension: 'time_of_day', bucket: 3 }),
      row({ dimension: 'time_of_day', bucket: 4 }),
      row({ dimension: 'time_of_day', bucket: 5 }),
    ]);

    expect(dimension(insights, 'session').buckets.map((b) => b.status)).toEqual([
      'not-enough-data',
      'ready',
      'ready',
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

  it('publishes only labels, a status, matches, a share and a win rate per bucket', () => {
    const insights = derive(weekdays());
    const bucketKeys = ['label', 'matches', 'share', 'status', 'winRate'];

    for (const bucket of insights.dimensions.flatMap((d) => d.buckets)) {
      expect(Object.keys(bucket).sort()).toEqual(bucketKeys);
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
