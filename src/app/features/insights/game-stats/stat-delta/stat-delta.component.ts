import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { DeltaView } from '../game-stats-view';

/** A change since the previous snapshot: drawn text for sighted readers, spoken text for screen readers. */
@Component({
  selector: 'app-stat-delta',
  template: `
    <span aria-hidden="true">{{ delta().text }}</span>
    <span class="visually-hidden">{{ delta().spoken }}</span>
  `,
  styleUrl: './stat-delta.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'delta',
    '[attr.data-trend]': 'delta().trend',
  },
})
export class StatDeltaComponent {
  readonly delta = input.required<DeltaView>();
}
