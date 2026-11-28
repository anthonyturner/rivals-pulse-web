import type { GameCounts } from '../../../../contracts/game-counts.model';
import type { ChartColumn, ChartLane } from '../../../shared/components/chart/column-chart/column-chart.component';
import { positionOf } from '../../../shared/components/chart/chart-geometry';
import { matchesCountedLabel } from '../../../shared/utilities/stat-labels';

/** One of the headline figures. */
export interface StatTileView {
  label: string;
  value: string;
}

/** The lanes of the half-season trend: matches counted, then players. */
export const HALF_SEASON_LANES: readonly ChartLane[] = [
  { name: 'Matches counted', kind: 'bars', tone: 'primary' },
  { name: 'Players', kind: 'bars', tone: 'secondary' },
];

/** More half-seasons than this are too many to print a figure over each bar; the tooltips and the table still carry them. */
const HALF_SEASON_VALUES_LIMIT = 8;

/**
 * What the page draws, in the order it is known: `loading` until the request answers, `error` when
 * it failed or answered something that is not counts, `empty` before any match is recorded.
 */
export type GameStatsView =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'empty' }
  | { status: 'ready'; meta: string; tiles: StatTileView[]; seasons: ChartColumn[]; showSeasonValues: boolean };

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
    meta: 'Counted from RivalsPulse overlay uploads: what the app has recorded, not everyone who plays Marvel Rivals.',
    tiles: [
      { label: matchesCountedLabel(counts.matches, 'all seasons', 'short'), value: numbers.format(counts.matches) },
      // The newest half-season's figure, which the home page and the Stats overview state too while it is the half-season they show.
      ...(newest === undefined || earlier.length === 0
        ? []
        : [{ label: matchesCountedLabel(newest.matches, seasonLabel(newest.halfSeason), 'short'), value: numbers.format(newest.matches) }]),
      { label: 'Players', value: numbers.format(counts.players) },
      ...(since === null ? [] : [{ label: 'Earliest match', value: since }]),
    ],
    seasons: halfSeasonColumns(counts),
    showSeasonValues: counts.halfSeasons.length <= HALF_SEASON_VALUES_LIMIT,
  };
}

/** Oldest first, so the chart reads left to right in time; each lane is scaled to its own largest figure. */
function halfSeasonColumns(counts: GameCounts): ChartColumn[] {
  const mostMatches = Math.max(...counts.halfSeasons.map((season) => season.matches));
  const mostPlayers = Math.max(...counts.halfSeasons.map((season) => season.players));

  return [...counts.halfSeasons].reverse().map((season) => ({
    label: seasonLabel(season.halfSeason),
    cells: [
      { position: positionOf(season.matches, 0, mostMatches), valueLabel: numbers.format(season.matches) },
      { position: positionOf(season.players, 0, mostPlayers), valueLabel: numbers.format(season.players) },
    ],
  }));
}

function seasonLabel(halfSeason: number): string {
  return `Season ${halfSeason}`;
}
