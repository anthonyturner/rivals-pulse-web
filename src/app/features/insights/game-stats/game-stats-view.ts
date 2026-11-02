import type {
  GameComparison,
  GameStatsResponse,
  MetricComparison,
  RankComparison,
} from '../../../../contracts/game-stats.model';
import { countLabel } from '../../../shared/utilities/stat-labels';

/** A change since the previous snapshot. The colour repeats `trend`; the sign, arrow and spoken text carry it. */
export interface DeltaView {
  /** What is drawn: "+3,392 (+8.52%)" or "▼2". Hidden from screen readers in favour of `spoken`. */
  text: string;
  /** What a screen reader says: "up 3,392, 8.52 percent" or "down 2 places". */
  spoken: string;
  trend: 'up' | 'down';
}

export interface CellView {
  /** A rank's change sits beside it; a count's change sits under it. */
  kind: 'metric' | 'rank';
  value: string;
  /** Null when the value did not change, or there is no earlier snapshot to compare with. */
  delta: DeltaView | null;
}

export interface GameRowView {
  name: string;
  category: string;
  /** The game the page is about, drawn with a fill so it stands out from the ones it is compared with. */
  subject: boolean;
  /** Players now, 24h peak, all-time peak, daily rank and top-seller rank: the table's columns in order. */
  cells: CellView[];
}

export interface GameStatsView {
  /** True when the live numbers could not be fetched and the saved snapshot is shown instead. */
  saved: boolean;
  snapshotDate: string;
  /** One sentence-case line saying which snapshot this is and what it is compared with. */
  meta: string;
  rows: GameRowView[];
}

const SUBJECT = 'Marvel Rivals';
const MINUS = '−';
const numbers = new Intl.NumberFormat('en-US');
const timestamps = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
});

/**
 * Turns a game-stats response into what the page draws. Every figure and label is built here, so a
 * template never formats a number or decides whether a change is worth showing.
 */
export function buildGameStatsView(stats: GameStatsResponse, saved: boolean): GameStatsView {
  return {
    saved,
    snapshotDate: stats.snapshotDate,
    meta: saved ? `Saved snapshot ${stats.snapshotDate}` : liveMeta(stats),
    rows: stats.games.map(gameRow),
  };
}

function liveMeta(stats: GameStatsResponse): string {
  const fetched = timestamp(stats.fetchedAt);
  const previous = stats.previousSnapshot === undefined ? null : timestamp(stats.previousSnapshot.capturedAt);

  return [
    `Snapshot ${stats.snapshotDate}`,
    fetched === null ? null : `Live players fetched ${fetched}`,
    stats.previousSnapshot === undefined
      ? 'First stored snapshot; comparisons begin with the next capture'
      : previous === null
        ? null
        : `Compared with ${previous}`,
  ]
    .filter((part): part is string => part !== null)
    .join(' · ');
}

function timestamp(value: string): string | null {
  const time = Date.parse(value);

  return Number.isNaN(time) ? null : timestamps.format(time);
}

function gameRow(game: GameComparison): GameRowView {
  const change = game.comparison;

  return {
    name: game.name,
    category: game.category,
    subject: game.name === SUBJECT,
    cells: [
      metricCell(game.currentPlayers, change?.currentPlayers),
      metricCell(game.dailyPeak, change?.dailyPeak),
      metricCell(game.allTimePeak, change?.allTimePeak),
      rankCell(game.steamDailyRank, change?.steamDailyRank),
      rankCell(game.topSellerRank, change?.topSellerRank),
    ],
  };
}

function metricCell(value: number, comparison: MetricComparison | undefined): CellView {
  return { kind: 'metric', value: numbers.format(value), delta: comparison === undefined ? null : metricDelta(comparison) };
}

function metricDelta({ change, changePercent }: MetricComparison): DeltaView | null {
  if (!Number.isFinite(change) || change === 0) {
    return null;
  }

  const up = change > 0;
  const sign = up ? '+' : MINUS;
  const percent = changePercent !== undefined && Number.isFinite(changePercent) ? Math.abs(changePercent).toFixed(2) : null;
  const amount = numbers.format(Math.abs(change));

  return {
    text: `${sign}${amount}${percent === null ? '' : ` (${sign}${percent}%)`}`,
    spoken: `${up ? 'up' : 'down'} ${amount}${percent === null ? '' : `, ${percent} percent`}`,
    trend: up ? 'up' : 'down',
  };
}

function rankCell(value: string, comparison: RankComparison | undefined): CellView {
  return { kind: 'rank', value, delta: comparison === undefined ? null : rankDelta(comparison) };
}

/** A rank that moved towards #1 is "up". */
function rankDelta({ positionsChanged }: RankComparison): DeltaView | null {
  if (positionsChanged === undefined || !Number.isFinite(positionsChanged) || positionsChanged === 0) {
    return null;
  }

  const up = positionsChanged > 0;
  const places = Math.abs(positionsChanged);

  return {
    text: `${up ? '▲' : '▼'}${places}`,
    spoken: `${up ? 'up' : 'down'} ${countLabel(places, 'place', 'places')}`,
    trend: up ? 'up' : 'down',
  };
}
