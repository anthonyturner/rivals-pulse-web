import type { GameCounts } from '../../../../contracts/game-counts.model';
import { matchesCountedLabel } from '../../../shared/utilities/stat-labels';

/** One of the headline figures. */
export interface StatTileView {
  label: string;
  value: string;
}

/** One half-season's row in the table. */
export interface HalfSeasonRowView {
  label: string;
  matches: string;
  players: string;
}

/**
 * What the page draws, in the order it is known: `loading` until the request answers, `error` when
 * it failed or answered something that is not counts, `empty` before any match is recorded.
 */
export type GameStatsView =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'empty' }
  | { status: 'ready'; meta: string; tiles: StatTileView[]; rows: HalfSeasonRowView[] };

const numbers = new Intl.NumberFormat('en-US');
const days = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/**
 * Turns the answer into what the page draws. Every figure and label is built here, so a template
 * never formats a number. `undefined` is a request still running; `null` is one that failed.
 */
export function buildGameStatsView(counts: GameCounts | null | undefined): GameStatsView {
  if (counts === undefined) {
    return { status: 'loading' };
  }

  if (counts === null) {
    return { status: 'error' };
  }

  if (counts.matches === 0) {
    return { status: 'empty' };
  }

  const [newest, ...earlier] = counts.halfSeasons;
  const since = counts.since === null ? null : days.format(Date.parse(counts.since));

  return {
    status: 'ready',
    meta: 'Counted from RivalsPulse overlay uploads',
    tiles: [
      { label: matchesCountedLabel(counts.matches, 'all seasons'), value: numbers.format(counts.matches) },
      // The same figure the home page and the community page state for that half-season.
      ...(newest === undefined || earlier.length === 0
        ? []
        : [{ label: matchesCountedLabel(newest.matches, seasonLabel(newest.halfSeason)), value: numbers.format(newest.matches) }]),
      { label: 'Players seen', value: numbers.format(counts.players) },
      ...(since === null ? [] : [{ label: 'Earliest match', value: since }]),
    ],
    rows: counts.halfSeasons.map((season) => ({
      label: seasonLabel(season.halfSeason),
      matches: numbers.format(season.matches),
      players: numbers.format(season.players),
    })),
  };
}

function seasonLabel(halfSeason: number): string {
  return `Season ${halfSeason}`;
}
