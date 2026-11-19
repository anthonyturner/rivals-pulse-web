import type { GameCounts } from '../../contracts/game-counts.model.ts';

/**
 * "Matches counted" for one half-season: the one figure every community page states under that
 * label. It is the matches `read_game_counts()` holds for the half-season, which counts each match
 * once however many players recorded it, in every mode, with or without a win or a loss. A
 * half-season the counts no longer hold is null, not zero: its matches are not known to be none.
 */
export function matchesCountedIn(counts: GameCounts, halfSeason: number): number | null {
  return counts.halfSeasons.find((season) => season.halfSeason === halfSeason)?.matches ?? null;
}
