import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import type { RateSide } from '../../../utilities/stat-labels';

/** Which side of its guide line a dot is on. It picks the dot's colour, and the position says the same, so colour is never the only signal. */
export type ChartSide = RateSide;

/** The series colours a lane can take. */
export type ChartTone = 'primary' | 'secondary' | 'tertiary';

/** One column's mark in one lane. */
export interface ChartCell {
  /** Where the bar ends or the dot sits, 0 to 100 of the lane scale. */
  position: number;
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
  /** The lane height in pixels; it never changes with the data. */
  height?: number;
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

const DEFAULT_LANE_HEIGHT = 96;

/** A dot keeps this share of the lane clear above and below, so its value fits on either side and never runs into the axis. */
const DOT_INSET = 18;

/** Where a mark sits in its lane: bars use the full height, dots stay inside the inset. */
function laneOffset(position: number, isBars: boolean): number {
  return isBars ? position : DOT_INSET + (position * (100 - 2 * DOT_INSET)) / 100;
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
  /** Whether each mark prints its figure above itself. Turn it off for a chart too crowded to fit them; the tooltips and the table keep them. */
  readonly showValues = input(true);
  /** The id of an element that explains how the figures are counted; the data table points at it so a screen reader reads it with the numbers. */
  readonly describedBy = input<string | null>(null);

  protected readonly view = computed(() => {
    const lanes = this.lanes();
    const columns = this.columns();
    const emptyLabel = this.emptyLabel();

    return {
      count: columns.length,
      axis: columns.map((column) => column.shortLabel ?? column.label),
      lanes: lanes.map((lane, laneIndex) => {
        const isBars = lane.kind === 'bars';

        return {
          name: lane.name,
          isBars,
          tone: lane.tone ?? 'primary',
          height: lane.height ?? DEFAULT_LANE_HEIGHT,
          guide: lane.guide ? { ...lane.guide, position: laneOffset(lane.guide.position, isBars) } : null,
          cells: columns.map((column) => {
            const cell = column.cells[laneIndex] ?? null;

            return cell === null
              ? null
              : {
                  ...cell,
                  position: laneOffset(cell.position, isBars),
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
