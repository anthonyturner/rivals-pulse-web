/** One half-season's counts of what the app has seen. */
export interface GameCountsHalfSeason {
  /** The half-season number, such as 10 or 10.5. */
  halfSeason: number;
  matches: number;
  /** Different players on the scoreboards of those matches. */
  players: number;
}

/**
 * The game-level counts on /game-stats: matches and players seen in RivalsPulse overlay uploads, and
 * nothing from outside the app. Only counts: no player, match or recorder is named. They cover the
 * matches the app still holds, which is at most about six months of play.
 */
export interface GameCounts {
  matches: number;
  /** Different players seen on those matches' scoreboards, each counted once. */
  players: number;
  /** When the earliest counted match was played, or null before any match is recorded. */
  since: string | null;
  /** Newest half-season first. Empty before any match is recorded. */
  halfSeasons: GameCountsHalfSeason[];
}
