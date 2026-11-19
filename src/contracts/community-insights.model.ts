/** One row of a dimension: a weekday, a four-hour block of the day, or a place in a play session. */
export interface CommunityInsightsBucket {
  label: string;
  /** `not-enough-data` buckets carry no figures at all, so a thin bucket cannot be read off the page. */
  status: 'ready' | 'not-enough-data';
  /**
   * The bucket's matches as a whole percentage (0 to 100) of the matches of the shown buckets of its
   * dimension. No exact match count is published anywhere: every dimension adds up to the same total,
   * so a count would let a hidden bucket be found by subtraction.
   */
  share: number | null;
  /** Wins as a whole percentage (0 to 100) of matches with a win or a loss, or null when too few have one. */
  winRate: number | null;
}

export interface CommunityInsightsDimension {
  id: 'weekday' | 'time-of-day' | 'session';
  title: string;
  buckets: CommunityInsightsBucket[];
}

/**
 * When the community plays and wins, from matches recorded by RivalsPulse players. Every time is UTC.
 *
 * `ready` means at least one dimension has enough shown buckets; `not-enough-data` is a designed state,
 * not an error, and is also what the site answers while the aggregates do not exist yet. The database
 * withholds every bucket that fails its gates, so a bucket that is not shown has no figure here. Shares
 * are taken over the shown buckets only and there are no counts, so nothing published adds up to, or
 * differs by, a hidden bucket.
 */
export interface CommunityInsights {
  status: 'ready' | 'not-enough-data';
  timeZone: 'UTC';
  /** Idle minutes between two of a player's matches that end a play session, or null when unknown. */
  sessionGapMinutes: number | null;
  /** Matches a bucket needs, in one half-season, before it, or its win rate, is shown. Null when unknown. */
  minimumMatches: number | null;
  dimensions: CommunityInsightsDimension[];
}
