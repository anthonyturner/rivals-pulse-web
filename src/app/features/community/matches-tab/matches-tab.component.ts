import { ChangeDetectionStrategy, Component, computed } from '@angular/core';

import { CommunitySummaryComponent } from '../community-summary/community-summary.component';
import { dayLabel } from '../own-activity/day-label';
import { injectOwnActivity, ownActivityRows, type OwnActivityTableView } from '../own-activity/own-activity';
import { OwnActivityTablesComponent } from '../own-activity/own-activity-tables.component';

/** The signed-in account's own matches, by map, mode and day. No other account can see them. */
@Component({
  selector: 'app-community-matches-tab',
  imports: [CommunitySummaryComponent, OwnActivityTablesComponent],
  template: `
    @let current = state();

    <app-community-summary
      [kind]="current.kind"
      heading="My matches"
      subject="your matches"
      [summary]="current.kind === 'not-enough-data' ? current.summary : ''"
      [link]="current.kind === 'not-enough-data' ? current.link : null"
      [footnote]="
        current.kind === 'ready'
          ? 'Only your account can see this. Maps and days count Competitive and Quick Match; game modes count everything. Days are UTC.' + (current.truncated ? ' Your newest 2,000 matches.' : '')
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
export class MatchesTabComponent {
  protected readonly state = injectOwnActivity('/community/matches');
  protected readonly tables = computed((): OwnActivityTableView[] | null => {
    const current = this.state();

    if (current.kind !== 'ready') {
      return null;
    }

    const { maps, modes, days } = current.activity;

    return [
      { title: 'Win rate by map', rowHeading: 'Map', rows: ownActivityRows(maps) },
      { title: 'Game modes played', rowHeading: 'Mode', rows: ownActivityRows(modes) },
      {
        title: 'Your last 30 days played',
        rowHeading: 'Day',
        rows: ownActivityRows(days).map((row) => ({ ...row, label: dayLabel(row.label) })),
      },
    ];
  });
}
