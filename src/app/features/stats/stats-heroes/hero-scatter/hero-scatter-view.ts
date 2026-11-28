import { axisValues, axisWindow, tickStep } from '../../../../shared/components/chart/chart-geometry';
import type {
  ScatterAxis,
  ScatterGuide,
  ScatterPoint,
} from '../../../../shared/components/chart/scatter-chart/scatter-chart.component';
import type { WinRateRowView } from '../hero-table/win-rates-view';

/** The headings of the hidden table's columns after pick rate and win rate, in the order of each point's figures. */
export const HERO_SCATTER_COLUMNS: readonly string[] = ['Role', 'Record'];

/** The roles whose ring colour the chart's key names. */
export const HERO_SCATTER_ROLES: readonly string[] = ['Vanguard', 'Duelist', 'Strategist'];

export interface HeroScatterView {
  xAxis: ScatterAxis;
  yAxis: ScatterAxis;
  guides: ScatterGuide[];
  /** Heroes with the most games last, so the best-founded dots are on top where portraits overlap. */
  points: ScatterPoint[];
}

/** Win rates are drawn in a window around the heroes and the 50% line, not the whole 0 to 100. */
const WIN_RATE_WINDOW = { anchor: 50, pad: 3, step: 5, minSpan: 20, floor: 0, ceiling: 100 } as const;

/** Few enough ticks to label on a phone. */
const MAX_TICKS = 5;

/**
 * What the win rate against pick rate chart draws, from the same ranked rows as the table below it, so
 * the chart and the table can never name different heroes. A hero with no pick rate cannot be placed
 * and is left out. Null when no hero can be placed, so no empty chart is drawn.
 */
export function buildHeroScatterView(ranked: readonly WinRateRowView[]): HeroScatterView | null {
  const placed = ranked.filter(
    (row): row is WinRateRowView & { pickRate: number } => row.pickRate !== null && Number.isFinite(row.winRate),
  );

  if (placed.length === 0) {
    return null;
  }

  const window = axisWindow(
    placed.map((row) => row.winRate),
    WIN_RATE_WINDOW,
  );
  const xMax = Math.max(...placed.map((row) => row.pickRate));
  const xStep = tickStep(xMax, MAX_TICKS);
  const xEnd = Math.ceil(xMax / xStep) * xStep;
  const yStep = tickStep(window.max - window.min, MAX_TICKS);

  return {
    xAxis: {
      title: 'Pick rate',
      min: 0,
      max: xEnd,
      ticks: axisValues(0, xEnd, xStep).map((value) => ({ value, label: `${value}%` })),
    },
    yAxis: {
      title: 'Win rate',
      min: window.min,
      max: window.max,
      ticks: axisValues(Math.ceil(window.min / yStep) * yStep, window.max, yStep).map((value) => ({ value, label: `${value}%` })),
    },
    guides: [{ axis: 'y', value: 50, label: '50% win rate' }],
    points: [...placed]
      .sort((a, b) => a.appearances - b.appearances || a.name.localeCompare(b.name))
      .map((row) => ({
        id: row.hero,
        label: row.name,
        x: row.pickRate,
        y: row.winRate,
        imageUrl: row.imageUrl,
        role: row.role,
        link: ['/heroes', row.hero],
        figures: [row.pickRateLabel, row.winRateLabel, row.role ?? 'No role', row.winsGamesSpoken],
        description: `${row.name}: ${row.winRateLabel} win rate, ${row.pickRateLabel} pick rate, ${row.winsGamesSpoken}`,
      })),
  };
}
