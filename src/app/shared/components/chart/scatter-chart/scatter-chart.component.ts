import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { HeroImageFallbackDirective } from '../../../directives/hero-image-fallback.directive';
import { positionOf } from '../chart-geometry';

/** One end-to-end scale of the plot, with the ticks that are labelled. */
export interface ScatterAxis {
  title: string;
  min: number;
  max: number;
  ticks: readonly { value: number; label: string }[];
}

/** A line across the plot at one value of an axis, such as the 50% win rate. */
export interface ScatterGuide {
  axis: 'x' | 'y';
  value: number;
  label: string;
}

/** One hero: a portrait that links to the hero page. */
export interface ScatterPoint {
  id: string;
  label: string;
  x: number;
  y: number;
  imageUrl: string;
  /** The hero role, such as `Vanguard`; the portrait is ringed in its colour. */
  role: string | null;
  /** The router path the portrait opens. */
  link: readonly string[];
  /** The figures as the chart prints them: the x figure, the y figure, then one per entry of `columns`. */
  figures: readonly string[];
  /** The point in words, for its tooltip. */
  description: string;
}

/**
 * Hero portraits placed by two figures, such as win rate against pick rate. The plot is hidden from
 * assistive technology and the pointer-only links skip the tab order, because a visually hidden table
 * prints every point and the page lists the same heroes in a table of its own. The plot takes its
 * height from CSS alone, so it is as tall before it has data as after.
 */
@Component({
  selector: 'app-scatter-chart',
  imports: [HeroImageFallbackDirective, RouterLink],
  templateUrl: './scatter-chart.component.html',
  styleUrl: './scatter-chart.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScatterChartComponent {
  /** Names the chart: the data table caption. */
  readonly caption = input.required<string>();
  /** The heading of the first table column, such as "Hero". */
  readonly rowHeader = input.required<string>();
  readonly xAxis = input.required<ScatterAxis>();
  readonly yAxis = input.required<ScatterAxis>();
  /** The headings of the table columns after the two axes, in the order of `ScatterPoint.figures`. */
  readonly columns = input<readonly string[]>([]);
  readonly guides = input<readonly ScatterGuide[]>([]);
  /** Drawn in order, so the last one is on top. */
  readonly points = input.required<readonly ScatterPoint[]>();

  protected readonly view = computed(() => {
    const x = this.xAxis();
    const y = this.yAxis();

    return {
      xTitle: x.title,
      yTitle: y.title,
      xTicks: x.ticks.map((tick) => ({ label: tick.label, position: positionOf(tick.value, x.min, x.max) })),
      yTicks: y.ticks.map((tick) => ({ label: tick.label, position: positionOf(tick.value, y.min, y.max) })),
      guides: this.guides().map((guide) => {
        const axis = guide.axis === 'x' ? x : y;

        return { ...guide, isHorizontal: guide.axis === 'y', position: positionOf(guide.value, axis.min, axis.max) };
      }),
      dots: this.points().map((point) => ({
        ...point,
        roleKey: point.role?.trim().toLowerCase() || null,
        left: positionOf(point.x, x.min, x.max),
        bottom: positionOf(point.y, y.min, y.max),
      })),
    };
  });
}
