import { ChangeDetectionStrategy, Component, computed } from '@angular/core';

import { CommunitySummaryComponent } from '../community-summary/community-summary.component';
import { injectOwnActivity, ownActivityRows } from '../own-activity/own-activity';
import { OwnActivityTableComponent } from '../own-activity/own-activity-table.component';

/** When the signed-in account plays and wins. No other account can see it. */
@Component({
  selector: 'app-community-insights-tab',
  imports: [CommunitySummaryComponent, OwnActivityTableComponent],
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
          ? 'Only your account can see this. Competitive and Quick Match; all days and times are UTC.' +
            (current.truncated ? ' Your newest 2,000 matches.' : '')
          : null
      "
    >
      @if (tables(); as table) {
        <div class="panels">
          <app-own-activity-table title="Day of the week" rowHeading="Day" [rows]="table.weekdays" />
          <app-own-activity-table title="Time of day" rowHeading="Time" [rows]="table.timesOfDay" />
          <app-own-activity-table title="Place in a play session" rowHeading="Place" [rows]="table.sessionPlaces" />
        </div>
      }
    </app-community-summary>
  `,
  styles: `
    .panels {
      display: grid;
      gap: 12px;
    }

    @media (min-width: 1024px) {
      .panels {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InsightsTabComponent {
  protected readonly state = injectOwnActivity('/community/insights');
  protected readonly tables = computed(() => {
    const current = this.state();

    if (current.kind !== 'ready') {
      return null;
    }

    const { weekdays, timesOfDay, sessionPlaces } = current.activity;

    return {
      weekdays: ownActivityRows(weekdays),
      timesOfDay: ownActivityRows(timesOfDay),
      sessionPlaces: ownActivityRows(sessionPlaces),
    };
  });
}
