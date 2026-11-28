import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { PULSE_RECORDS_BOARD_SIZE } from '../../../../contracts/pulse-records.model';
import { FilterSelectComponent, type FilterOption } from '../../../shared/components/filter-select/filter-select.component';
import { injectRecordsView } from '../../records/inject-records-view';
import { PULSE_RECORDS_PAGES } from '../../records/pulse-records.data';
import { PULSE_RECORDS_MIN_ROWS, PULSE_RECORDS_PREVIEW_ROWS } from '../../records/pulse-records-view';
import { RecordTableComponent } from '../../records/record-table/record-table.component';
import { RecordsBodyComponent, RecordsContentDirective } from '../../records/records-body/records-body.component';

/** The query parameter that holds the chosen list, by its slug. */
export const RECORDS_CATEGORY_PARAM = 'category';

const ALL_RECORDS = '';

const CATEGORY_OPTIONS: readonly FilterOption[] = [
  { value: ALL_RECORDS, label: 'All records' },
  ...PULSE_RECORDS_PAGES.map((page) => ({ value: page.slug, label: page.title })),
];

/**
 * Every Pulse Records list on one page. With no category chosen it shows the best few lines of each
 * list; choosing one shows that list in full. The choice is in the address (`?category=kills`), so a
 * list can be linked to. An unknown category is the same as none.
 */
@Component({
  selector: 'app-stats-records',
  imports: [FilterSelectComponent, RecordsBodyComponent, RecordsContentDirective, RecordTableComponent, RouterLink],
  templateUrl: './stats-records.component.html',
  styleUrl: './stats-records.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatsRecordsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly category = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get(RECORDS_CATEGORY_PARAM))),
    { initialValue: null },
  );
  /** The list the address names, or null for all of them. */
  private readonly chosen = computed(() => PULSE_RECORDS_PAGES.find((page) => page.slug === this.category()) ?? null);

  protected readonly state = injectRecordsView(() => (this.chosen() ? PULSE_RECORDS_BOARD_SIZE : PULSE_RECORDS_PREVIEW_ROWS));
  protected readonly minimumRows = PULSE_RECORDS_MIN_ROWS;
  protected readonly options = CATEGORY_OPTIONS;
  protected readonly selectedValue = computed(() => this.chosen()?.slug ?? ALL_RECORDS);

  /** The lists on screen, each with the address query that opens it alone. */
  protected readonly boards = computed(() => {
    const chosen = this.chosen();

    return (this.state.view()?.boards ?? [])
      .filter((board) => chosen === null || board.page === chosen)
      .map((board) => ({ ...board, openQuery: { [RECORDS_CATEGORY_PARAM]: board.page.slug } }));
  });
  protected readonly single = computed(() => this.chosen() !== null);
  protected readonly shown = computed(() => this.boards().some((board) => board.shown));

  protected choose(value: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [RECORDS_CATEGORY_PARAM]: value === ALL_RECORDS ? null : value },
      queryParamsHandling: 'merge',
    });
  }
}
