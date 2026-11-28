import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { segmentWidths } from '../chart-geometry';

/** The series colours the stylesheet defines, `s0` to `s4`. */
const SERIES_COUNT = 5;

/** One part of the bar. `value` is only compared with the other parts; `valueLabel` is what is printed. */
export interface StackedBarPart {
  label: string;
  value: number;
  valueLabel: string;
  /** A second line under the label, such as the mode's average length. */
  detail?: string;
}

/**
 * One bar cut into parts, with a legend that carries every figure as text, so the bar itself is hidden
 * from assistive technology. The parts take the series colours in order.
 */
@Component({
  selector: 'app-stacked-bar',
  templateUrl: './stacked-bar.component.html',
  styleUrl: './stacked-bar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StackedBarComponent {
  readonly parts = input.required<readonly StackedBarPart[]>();

  protected readonly view = computed(() => {
    const parts = this.parts();
    const widths = segmentWidths(parts.map((part) => part.value));

    return parts.map((part, index) => ({
      ...part,
      series: index % SERIES_COUNT,
      width: widths[index] ?? 0,
      title: `${part.label}: ${part.valueLabel}`,
    }));
  });
}
