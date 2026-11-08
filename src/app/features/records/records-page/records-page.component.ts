import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { injectRecordsView } from '../inject-records-view';
import { PULSE_RECORDS_MIN_ROWS, PULSE_RECORDS_PREVIEW_ROWS } from '../pulse-records-view';
import { RecordsBodyComponent, RecordsContentDirective } from '../records-body/records-body.component';
import { RecordTableComponent } from '../record-table/record-table.component';

/** `/records`: the best five lines of each board, with a link to the longer list. */
@Component({
  selector: 'app-records-page',
  imports: [PageHeaderComponent, RecordsBodyComponent, RecordsContentDirective, RecordTableComponent, RouterLink],
  templateUrl: './records-page.component.html',
  styleUrl: './records-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordsPageComponent {
  protected readonly state = injectRecordsView(PULSE_RECORDS_PREVIEW_ROWS);
  protected readonly minimumRows = PULSE_RECORDS_MIN_ROWS;
}
