import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { map } from 'rxjs';

import { PULSE_RECORDS_BOARD_SIZE } from '../../../../contracts/pulse-records.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { injectRecordsView } from '../inject-records-view';
import { PULSE_RECORDS_PAGES, type PulseRecordsPage } from '../pulse-records.data';
import { PULSE_RECORDS_MIN_ROWS } from '../pulse-records-view';
import { RecordsBodyComponent, RecordsContentDirective } from '../records-body/records-body.component';
import { RecordTableComponent } from '../record-table/record-table.component';

/** `/records/<list>`: one board in full. Each list has its own route, which carries the list in its `data`. */
@Component({
  selector: 'app-records-category-page',
  imports: [
    PageHeaderComponent,
    RecordsBodyComponent,
    RecordsContentDirective,
    RecordTableComponent,
    RouterLink,
    RouterLinkActive,
  ],
  templateUrl: './records-category-page.component.html',
  styleUrl: './records-category-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordsCategoryPageComponent {
  protected readonly state = injectRecordsView(PULSE_RECORDS_BOARD_SIZE);
  protected readonly minimumRows = PULSE_RECORDS_MIN_ROWS;
  protected readonly pages = PULSE_RECORDS_PAGES;

  /** What the address names, known before the numbers arrive. The route's `data` carries it. */
  protected readonly page = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => (data['recordsPage'] as PulseRecordsPage | undefined) ?? null)),
    { initialValue: null },
  );
  protected readonly board = computed(() => this.state.view()?.boards.find((board) => board.page === this.page()) ?? null);
}
