import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { OwnActivityTableView } from './own-activity';

/** Titled tables of a player's own matches: what each row is, how many matches, and the win rate. */
@Component({
  selector: 'app-own-activity-tables',
  template: `
    <div class="panels">
      @for (table of tables(); track table.title) {
        <section class="panel" [attr.aria-label]="table.title">
          <h3 class="panel-title">{{ table.title }}</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">{{ table.rowHeading }}</th>
                  <th scope="col">Matches</th>
                  <th scope="col">Win rate</th>
                </tr>
              </thead>
              <tbody>
                @for (row of table.rows; track row.label) {
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
                  <tr><td colspan="3">No Competitive or Quick Match games here yet.</td></tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
    </div>
  `,
  styleUrl: './own-activity-tables.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OwnActivityTablesComponent {
  readonly tables = input.required<readonly OwnActivityTableView[]>();
}
