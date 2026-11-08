import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { HeroImageFallbackDirective } from '../../../shared/directives/hero-image-fallback.directive';
import type { RecordRowView } from '../pulse-records-view';

/**
 * The rows of one board: place, hero, player and figure. A line the player did not choose to name
 * reads "Anonymous". It shows no time and links to no match, because the read carries neither.
 */
@Component({
  selector: 'app-record-table',
  imports: [HeroImageFallbackDirective],
  templateUrl: './record-table.component.html',
  styleUrl: './record-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordTableComponent {
  readonly rows = input.required<readonly RecordRowView[]>();
  /** The id of the heading that names the board, for the table's accessible name. */
  readonly labelledBy = input.required<string>();
  /** The figure's name, such as "Kills", for the last column's header. */
  readonly valueLabel = input.required<string>();
}
