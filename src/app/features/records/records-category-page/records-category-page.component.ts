import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { map } from 'rxjs';

import { PULSE_RECORDS_BOARD_SIZE } from '../../../../contracts/pulse-records.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { injectRecordsView } from '../inject-records-view';
import { findPulseRecordsPage, PULSE_RECORDS_PAGES } from '../pulse-records.data';
import { PULSE_RECORDS_MIN_ROWS } from '../pulse-records-view';
import { RecordsCoverageComponent } from '../records-coverage/records-coverage.component';
import { RecordTableComponent } from '../record-table/record-table.component';

/** `/records/:category`: one board in full. The route's `knownIdGuard` has already checked the category. */
@Component({
  selector: 'app-records-category-page',
  imports: [
    PageHeaderComponent,
    RecordsCoverageComponent,
    RecordTableComponent,
    RouterLink,
    RouterLinkActive,
    StatePanelComponent,
  ],
  templateUrl: './records-category-page.component.html',
  styleUrl: './records-category-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordsCategoryPageComponent {
  protected readonly state = injectRecordsView(PULSE_RECORDS_BOARD_SIZE);
  protected readonly minimumRows = PULSE_RECORDS_MIN_ROWS;
  protected readonly pages = PULSE_RECORDS_PAGES;

  private readonly slug = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('category'))), {
    initialValue: null,
  });

  /** What the address names, known before the numbers arrive. */
  protected readonly page = computed(() => findPulseRecordsPage(this.slug()) ?? null);
  protected readonly board = computed(() => this.state.view()?.boards.find((board) => board.page === this.page()) ?? null);
}
