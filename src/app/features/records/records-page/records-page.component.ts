import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { injectRecordsView } from '../inject-records-view';
import { PULSE_RECORDS_MIN_ROWS, PULSE_RECORDS_PREVIEW_ROWS } from '../pulse-records-view';
import { RecordsCoverageComponent } from '../records-coverage/records-coverage.component';
import { RecordTableComponent } from '../record-table/record-table.component';

/** `/records`: the best five lines of each board, with a link to the longer list. */
@Component({
  selector: 'app-records-page',
  imports: [PageHeaderComponent, RecordsCoverageComponent, RecordTableComponent, RouterLink, StatePanelComponent],
  templateUrl: './records-page.component.html',
  styleUrl: './records-page.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RecordsPageComponent {
  protected readonly state = injectRecordsView(PULSE_RECORDS_PREVIEW_ROWS);
  protected readonly minimumRows = PULSE_RECORDS_MIN_ROWS;
}
