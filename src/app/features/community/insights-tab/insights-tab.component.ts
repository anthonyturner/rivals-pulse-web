import { ChangeDetectionStrategy, Component, computed } from '@angular/core';

import { CommunitySummaryComponent } from '../community-summary/community-summary.component';
import { injectOwnActivity, ownActivityRows, type OwnActivityTableView } from '../own-activity/own-activity';
import { OwnActivityTablesComponent } from '../own-activity/own-activity-tables.component';

/** When the signed-in account plays and wins. No other account can see it. */
@Component({
  selector: 'app-community-insights-tab',
  imports: [CommunitySummaryComponent, OwnActivityTablesComponent],
  template: `
    @let current = state();

    <app-community-summary
      [kind]="current.kind"
      heading="When I play and win"
      subject="your insights"
      [summary]="current.kind === 'not-enough-data' ? current.summary : ''"
      [link]="current.kind === 'not-enough-data' ? current.link : null"
      [footnote]="
        current.kind === 'ready'
          ? 'Only your account can see this. Competitive and Quick Match; all days and times are UTC.' + (current.truncated ? ' Your newest 2,000 matches.' : '')
          : null
      "
    >
      @if (tables(); as list) {
        <app-own-activity-tables [tables]="list" />
      }
    </app-community-summary>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsightsTabComponent {
  protected readonly state = injectOwnActivity('/community/insights');
  protected readonly tables = computed((): OwnActivityTableView[] | null => {
    const current = this.state();

    if (current.kind !== 'ready') {
      return null;
    }

    const { weekdays, timesOfDay, sessionPlaces } = current.activity;

    return [
      { title: 'Day of the week', rowHeading: 'Day', rows: ownActivityRows(weekdays) },
      { title: 'Time of day', rowHeading: 'Time', rows: ownActivityRows(timesOfDay) },
      { title: 'Place in a play session', rowHeading: 'Place', rows: ownActivityRows(sessionPlaces) },
    ];
  });
}
