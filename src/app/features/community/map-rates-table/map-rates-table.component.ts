import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { CommunityMapRowView } from '../matches-tab/community-maps-view';

/** A list of maps with each one's win rate and a bar, as the Overview's short list and the Maps tab's lists show them. */
@Component({
  selector: 'app-map-rates-table',
  templateUrl: './map-rates-table.component.html',
  styleUrls: ['../../../shared/styles/stat-panels.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapRatesTableComponent {
  readonly rows = input.required<readonly CommunityMapRowView[]>();
  /** What the table lists, for a screen reader. */
  readonly caption = input.required<string>();
  /** A name for the rows, such as "Best", set as a row above them; null for a table that needs none. */
  readonly group = input<string | null>(null);
}
