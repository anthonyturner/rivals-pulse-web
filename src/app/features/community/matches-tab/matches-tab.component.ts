import { ChangeDetectionStrategy, Component, computed } from '@angular/core';

import { CommunitySummaryComponent } from '../community-summary/community-summary.component';
import { dayLabel } from '../own-activity/day-label';
import { injectOwnActivity, ownActivityRows } from '../own-activity/own-activity';
import { OwnActivityTableComponent } from '../own-activity/own-activity-table.component';

/** The signed-in account's own matches, by map, mode and day. No other account can see them. */
@Component({
  selector: 'app-community-matches-tab',
  imports: [CommunitySummaryComponent, OwnActivityTableComponent],
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
          ? 'Only your account can see this. Days are UTC.' + (current.truncated ? ' Your newest 2,000 matches.' : '')
          : null
      "
    >
      @if (tables(); as table) {
        <div class="panels">
          <app-own-activity-table title="Win rate by map" rowHeading="Map" [rows]="table.maps" />
          <app-own-activity-table title="Game modes played" rowHeading="Mode" [rows]="table.modes" />
          <app-own-activity-table title="Your last 30 days played" rowHeading="Day" [rows]="table.days" />
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
export class MatchesTabComponent {
  protected readonly state = injectOwnActivity('/community/matches');
  protected readonly tables = computed(() => {
    const current = this.state();

    if (current.kind !== 'ready') {
      return null;
    }

    const { maps, modes, days } = current.activity;

    return {
      maps: ownActivityRows(maps),
      modes: ownActivityRows(modes),
      days: ownActivityRows(days).map((row) => ({ ...row, label: dayLabel(row.label) })),
    };
  });
}
