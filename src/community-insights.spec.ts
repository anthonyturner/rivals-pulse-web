import type { CommunityInsights } from './contracts/community-insights.model.js';
import {
  deriveCommunityInsights,
  INSIGHTS_MIN_MATCHES,
  INSIGHTS_MIN_RECORDERS,
  type InsightsBucketRow,
} from './community-insights.js';

function row(overrides: Partial<InsightsBucketRow>): InsightsBucketRow {
  return {
    halfSeason: 10.5,
    dimension: 'weekday',
    bucket: 1,
    matches: 40,
    decidedMatches: 40,
    wins: 20,
    recorders: 4,
    ...overrides,
  };
}

function derive(buckets: InsightsBucketRow[]): CommunityInsights {
  return deriveCommunityInsights({ sessionGapMinutes: 30, buckets });
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
  it('names every bucket of every dimension, all not enough data, when nothing was counted', () => {
    const insights = derive([]);

    expect(insights.status).toBe('not-enough-data');
    expect(insights.timeZone).toBe('UTC');
    expect(insights.minimumMatches).toBe(INSIGHTS_MIN_MATCHES);
    expect(insights.minimumRecorders).toBe(INSIGHTS_MIN_RECORDERS);
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

  it('carries the session gap the database used, and null when there is no answer', () => {
    expect(derive([]).sessionGapMinutes).toBe(30);
    expect(deriveCommunityInsights(null).sessionGapMinutes).toBeNull();
    expect(deriveCommunityInsights(null).status).toBe('not-enough-data');
  });

  it('shows a bucket at exactly the minimum matches and recorders, with its win rate', () => {
    const insights = derive([
      row({ matches: INSIGHTS_MIN_MATCHES, decidedMatches: INSIGHTS_MIN_MATCHES, wins: 18, recorders: INSIGHTS_MIN_RECORDERS }),
    ]);

    expect(insights.status).toBe('ready');
    expect(dimension(insights, 'weekday').buckets[0]).toEqual({
      label: 'Monday',
      status: 'ready',
      matches: INSIGHTS_MIN_MATCHES,
      share: 100,
      winRate: 60,
    });
  });

  it('hides a bucket one match short of the minimum', () => {
    const insights = derive([row({ matches: INSIGHTS_MIN_MATCHES - 1, decidedMatches: INSIGHTS_MIN_MATCHES - 1 })]);

    expect(insights.status).toBe('not-enough-data');
    expect(dimension(insights, 'weekday').buckets[0]).toEqual({ label: 'Monday', ...NOT_ENOUGH });
  });

  it('hides a bucket recorded by too few players however many matches it has', () => {
    const insights = derive([row({ matches: 900, decidedMatches: 900, wins: 450, recorders: INSIGHTS_MIN_RECORDERS - 1 })]);

    expect(insights.status).toBe('not-enough-data');
    expect(dimension(insights, 'weekday').buckets[0]).toEqual({ label: 'Monday', ...NOT_ENOUGH });
  });

  it('shows the volume but no win rate when too few matches have a win or a loss', () => {
    const insights = derive([row({ matches: 60, decidedMatches: INSIGHTS_MIN_MATCHES - 1, wins: 10 })]);

    expect(dimension(insights, 'weekday').buckets[0]).toEqual({
      label: 'Monday',
      status: 'ready',
      matches: 60,
      share: 100,
      winRate: null,
    });
  });

  it('rounds a win rate to one decimal', () => {
    const insights = derive([row({ matches: 33, decidedMatches: 33, wins: 20 })]);

    expect(dimension(insights, 'weekday').buckets[0].winRate).toBe(60.6);
  });

  it('adds half-seasons together and takes the most recorders any one of them had', () => {
    const insights = derive([
      row({ halfSeason: 10, matches: 20, decidedMatches: 20, wins: 10, recorders: 2 }),
      row({ halfSeason: 10.5, matches: 20, decidedMatches: 18, wins: 9, recorders: 3 }),
    ]);

    expect(dimension(insights, 'weekday').buckets[0]).toEqual({
      label: 'Monday',
      status: 'ready',
      matches: 40,
      share: 100,
      winRate: 50,
    });
  });

  it('never reaches the recorder minimum by adding the recorders of different half-seasons', () => {
    const insights = derive([
      row({ halfSeason: 10, recorders: 2 }),
      row({ halfSeason: 10.5, recorders: 2 }),
    ]);

    expect(insights.status).toBe('not-enough-data');
  });

  it('measures a bucket against every match of its dimension, shown or not', () => {
    const insights = derive([
      row({ bucket: 1, matches: 30, decidedMatches: 30, wins: 15 }),
      row({ bucket: 2, matches: 10, decidedMatches: 10, wins: 5, recorders: 1 }),
    ]);

    const [monday, tuesday] = dimension(insights, 'weekday').buckets;
    expect(monday.share).toBe(75);
    expect(tuesday).toEqual({ label: 'Tuesday', ...NOT_ENOUGH });
  });

  it('places time-of-day blocks and session positions by their bucket number', () => {
    const insights = derive([row({ dimension: 'session_position', bucket: 4 }), row({ dimension: 'time_of_day', bucket: 5 })]);

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

  it('is ready when any one dimension has a shown bucket', () => {
    expect(derive([row({ dimension: 'session_position', bucket: 1 })]).status).toBe('ready');
  });

  it('publishes only labels, a status, matches, a share and a win rate per bucket', () => {
    const insights = derive([row({ recorders: 9, decidedMatches: 38 })]);
    const bucketKeys = ['label', 'matches', 'share', 'status', 'winRate'];

    for (const bucket of insights.dimensions.flatMap((d) => d.buckets)) {
      expect(Object.keys(bucket).sort()).toEqual(bucketKeys);
    }
    for (const group of insights.dimensions) {
      expect(Object.keys(group).sort()).toEqual(['buckets', 'id', 'title']);
    }
    expect(Object.keys(insights).sort()).toEqual([
      'dimensions',
      'minimumMatches',
      'minimumRecorders',
      'sessionGapMinutes',
      'status',
      'timeZone',
    ]);
  });
});
