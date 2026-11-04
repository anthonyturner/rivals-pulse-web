import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { OwnActivityRowView } from './own-activity';

/** One titled table of a player's own matches: what the rows are, how many matches, and the win rate. */
@Component({
  selector: 'app-own-activity-table',
  template: `
    <section class="panel" [attr.aria-label]="title()">
      <h3 class="panel-title">{{ title() }}</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">{{ rowHeading() }}</th>
              <th scope="col">Matches</th>
              <th scope="col">Win rate</th>
            </tr>
          </thead>
          <tbody>
            @for (row of rows(); track row.label) {
              <tr>
                <th scope="row">{{ row.label }}</th>
                <td>{{ row.matches }}</td>
                <td>
                  <div class="rate">
                    <strong>{{ row.winRate }}</strong>
                    <span class="bar" aria-hidden="true">
                      <span class="bar-fill" [style.width.%]="row.barPercent"></span>
                    </span>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="3">No matches here yet.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styleUrl: './own-activity-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OwnActivityTableComponent {
  readonly title = input.required<string>();
  readonly rowHeading = input.required<string>();
  readonly rows = input.required<readonly OwnActivityRowView[]>();
}
