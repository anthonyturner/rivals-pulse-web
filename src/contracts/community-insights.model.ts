/** One row of a dimension: a weekday, a four-hour block of the day, or a place in a play session. */
export interface CommunityInsightsBucket {
  label: string;
  /** `not-enough-data` buckets carry no figures at all, so a thin bucket cannot be read off the page. */
  status: 'ready' | 'not-enough-data';
  /** Matches that started in this bucket. */
  matches: number | null;
  /** The bucket's matches as a percentage (0 to 100) of the dimension's matches. */
  share: number | null;
  /** Wins as a percentage (0 to 100) of matches with a win or a loss, or null when too few have one. */
  winRate: number | null;
}

export interface CommunityInsightsDimension {
  id: 'weekday' | 'time-of-day' | 'session';
  title: string;
  buckets: CommunityInsightsBucket[];
}

/**
 * When the community plays and wins, from matches recorded by Rivals Pulse players. Every time is UTC.
 *
 * `ready` means at least one bucket cleared both minimums; `not-enough-data` is a designed state, not
 * an error, and is also what the site answers when the aggregates are not available yet.
 */
export interface CommunityInsights {
  status: 'ready' | 'not-enough-data';
  timeZone: 'UTC';
  /** Idle minutes between two of a player's matches that end a play session, or null when unknown. */
  sessionGapMinutes: number | null;
  /** Matches a bucket needs before it, or its win rate, is shown. */
  minimumMatches: number;
  /** Players who recorded matches in a bucket before it is shown, so a bucket is never one person's diary. */
  minimumRecorders: number;
  dimensions: CommunityInsightsDimension[];
}
