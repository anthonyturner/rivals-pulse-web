import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { RateSide } from '../../../utilities/stat-labels';

/** Which side of its guide line a dot is on. It picks the dot's colour, and the position says the same, so colour is never the only signal. */
export type ChartSide = RateSide;

/** The series colours a lane can take. */
export type ChartTone = 'primary' | 'secondary' | 'tertiary';

/** One column's mark in one lane. */
export interface ChartCell {
  /** Where the bar ends or the dot sits, 0 to 100 of the lane scale; null draws no mark, for a figure the table still has to say in words. */
  position: number | null;
  /** The figure as the chart and its table print it. */
  valueLabel: string;
  /** Colours a dot by which side of the lane guide it is on. */
  side?: ChartSide;
}

/** A row of marks that shares the chart columns: bars from the floor, or one dot per column. */
export interface ChartLane {
  /** The lane heading, and its column heading in the data table. */
  name: string;
  kind: 'bars' | 'dots';
  tone?: ChartTone;
  /** The lane height in pixels; it never changes with the data. Bars default to 96 and dots to 120. A dot lane keeps about two lines of text clear above and below each dot, so give it at least 80. */
  height?: number;
  /** A line printed beside the lane heading, such as the scale of the lane. Not part of the data table. */
  note?: string;
  /** A dashed line across the lane, such as the 50% win rate, named beside the lane heading. */
  guide?: { position: number; label: string } | null;
}

export interface ChartColumn {
  label: string;
  /** What the axis shows when the column is too narrow for `label`. */
  shortLabel?: string;
  /** One mark per lane, in the lane order; null where the column has no figure for that lane. */
  cells: readonly (ChartCell | null)[];
}

const DEFAULT_BARS_HEIGHT = 96;
const DEFAULT_DOTS_HEIGHT = 120;

/** Where a mark sits as a fraction of its lane, 0 to 1. The stylesheet keeps a dot clear of the lane edges, in em so it follows the figure's font size. */
function fractionOf(position: number): number {
  return Math.min(1, Math.max(0, position / 100));
}

/**
 * Lanes of bars or dots over one shared row of columns, drawn with plain elements so the server and
 * the browser render the same markup and the chart is as tall before it has data as after. The marks
 * are hidden from assistive technology; a visually hidden table prints every figure instead.
 */
@Component({
  selector: 'app-column-chart',
  templateUrl: './column-chart.component.html',
  styleUrl: './column-chart.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColumnChartComponent {
  /** Names the chart: the data table caption. */
  readonly caption = input.required<string>();
  /** The heading of the first table column, such as "Day". */
  readonly rowHeader = input.required<string>();
  readonly lanes = input.required<readonly ChartLane[]>();
  readonly columns = input.required<readonly ChartColumn[]>();
  /** What the table says for a column with no figure in a lane. */
  readonly emptyLabel = input('Not enough data');
  /** Explains the dash drawn where a column has no figure, such as "not enough data yet"; printed under the chart only when a dash is drawn. */
  readonly emptyKey = input<string | null>(null);
  /** Whether each mark prints its figure above itself. Turn it off for a chart too crowded to fit them; the tooltips and the table keep them. */
  readonly showValues = input(true);

  protected readonly view = computed(() => {
    const lanes = this.lanes();
    const columns = this.columns();
    const emptyLabel = this.emptyLabel();

    return {
      count: columns.length,
      hasEmpty: lanes.some((_, laneIndex) => columns.some((column) => (column.cells[laneIndex]?.position ?? null) === null)),
      axis: columns.map((column) => column.shortLabel ?? column.label),
      lanes: lanes.map((lane, laneIndex) => {
        const isBars = lane.kind === 'bars';
        const height = lane.height ?? (isBars ? DEFAULT_BARS_HEIGHT : DEFAULT_DOTS_HEIGHT);

        return {
          name: lane.name,
          note: lane.note ?? null,
          isBars,
          tone: lane.tone ?? 'primary',
          height,
          guide: lane.guide ? { ...lane.guide, fraction: fractionOf(lane.guide.position) } : null,
          cells: columns.map((column) => {
            const cell = column.cells[laneIndex] ?? null;

            return cell === null || cell.position === null
              ? { mark: false as const, title: `${column.label}: ${lane.name} ${cell?.valueLabel ?? emptyLabel}` }
              : {
                  mark: true as const,
                  fraction: fractionOf(cell.position),
                  valueLabel: cell.valueLabel,
                  side: cell.side ?? 'even',
                  title: `${column.label}: ${lane.name} ${cell.valueLabel}`,
                };
          }),
        };
      }),
      rows: columns.map((column) => ({
        label: column.label,
        values: lanes.map((_, laneIndex) => column.cells[laneIndex]?.valueLabel ?? emptyLabel),
      })),
    };
  });
}
