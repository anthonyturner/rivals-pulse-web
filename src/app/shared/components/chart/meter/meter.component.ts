import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { positionOf } from '../chart-geometry';

/**
 * A horizontal bar for one figure: the fill runs from the left to `value` on a track that spans `min`
 * to `max`, with an optional tick at `guide` (such as the 50% win rate). It draws no text and is
 * hidden from assistive technology, so the figure it shows must be written beside it. The fill takes
 * the colour in `--meter-fill` (the accent by default) and the height in `--meter-height`.
 */
@Component({
  selector: 'app-meter',
  template: `
    <span class="track">
      <span class="fill" [style.width.%]="fill()"></span>
      @if (tick() !== null) {
        <span class="guide" [style.left.%]="tick()"></span>
      }
    </span>
  `,
  styleUrl: './meter.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
})
export class MeterComponent {
  readonly value = input.required<number>();
  readonly min = input(0);
  readonly max = input(100);
  /** Where to draw the tick, in the same units as `value`; none when null. */
  readonly guide = input<number | null>(null);

  protected readonly fill = computed(() => positionOf(this.value(), this.min(), this.max()));
  protected readonly tick = computed(() => {
    const guide = this.guide();

    return guide === null ? null : positionOf(guide, this.min(), this.max());
  });
}
