import { gameStatsRunResult } from '../src/server/sync/game-stats-sync.ts';
import type { GameStatsCapture } from '../src/server/sync/game-stats-sync.ts';

/** What `npm run sync:game-stats` prints for a capture, and whether it counts as a failed run. */
export interface GameStatsReport {
  lines: string[];
  failed: boolean;
}

/**
 * Says what the capture really came to. The sentence is the one the run is logged with in
 * `sync_runs` (`gameStatsRunResult`), so the terminal and the admin page never tell two stories:
 * a capture stored, one the hour already had, or nothing stored and why. Only a capture that
 * was not stored because of a failure is a failed run; an hour that already had its capture is not.
 */
export function reportGameStatsCapture(capture: GameStatsCapture): GameStatsReport {
  const { response, failure } = capture;
  const { message } = gameStatsRunResult(capture);

  if (failure !== undefined) {
    return { lines: [message], failed: true };
  }

  return {
    lines: [
      message,
      `Games: ${response.games.length}`,
      `Compared with: ${response.previousSnapshot?.snapshotDate ?? 'no earlier snapshot'}`,
    ],
    failed: false,
  };
}
