import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { FilterOption, FilterSelectComponent } from '../../../shared/components/filter-select/filter-select.component';
import { NoticeComponent } from '../../../shared/components/notice/notice.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatePanelComponent } from '../../../shared/components/state-panel/state-panel.component';
import { GlossaryDataService } from './glossary-data.service';
import { GlossaryTerm } from './glossary.model';
import {
  ALL_CATEGORIES,
  buildRows,
  categoryLabel,
  filterRows,
  groupByLetter,
  letterId,
  resultsStatus,
  searchKey,
} from './glossary-view';

type LoadState = 'loading' | 'error' | 'ready';

/** How long typing must pause before the status line is rewritten, so a screen reader hears one count, not one per letter. */
const STATUS_SETTLE_MS = 400;

/** The A to Z nav's own id, which "Back to A–Z" jumps to. */
const LETTERS_ID = 'letters';

@Component({
  selector: 'app-glossary-page',
  imports: [FilterSelectComponent, NoticeComponent, PageHeaderComponent, RouterLink, StatePanelComponent],
  templateUrl: './glossary-page.component.html',
  styleUrls: [
    '../../learning/guides/guide-article/guide-article.css',
    '../../../shared/styles/disclosure-chevron.css',
    './glossary-page.component.css',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlossaryPageComponent {
  private readonly glossaryData = inject(GlossaryDataService);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment);
  private readonly searchInput = viewChild.required<ElementRef<HTMLInputElement>>('search');
  private settleTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly terms = signal<readonly GlossaryTerm[]>([]);
  protected readonly loadState = signal<LoadState>('loading');
  protected readonly searchTerm = signal('');
  /** The search text the status line reports: it trails `searchTerm` by `STATUS_SETTLE_MS`. */
  private readonly settledSearch = signal('');
  protected readonly category = signal(ALL_CATEGORIES);
  /** Which rows are open, on its own clock so opening one row does not rebuild the others. */
  protected readonly open = signal<Record<string, boolean>>({});
  protected readonly unknownFragment = signal(false);

  private readonly rows = computed(() => buildRows(this.terms()));

  protected readonly categoryOptions = computed<FilterOption[]>(() => {
    const labels = new Map(this.rows().map((row) => [row.category, row.categoryLabel]));
    const options = [...labels].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label));

    return [{ value: ALL_CATEGORIES, label: 'All categories' }, ...options];
  });

  private readonly listed = computed(() => filterRows(this.rows(), this.category(), searchKey(this.searchTerm())));
  protected readonly groups = computed(() => groupByLetter(this.listed()));
  protected readonly showLetters = computed(() => this.groups().length >= 2);
  protected readonly filtersActive = computed(() => this.searchTerm().trim() !== '' || this.category() !== ALL_CATEGORIES);
  protected readonly noMatches = computed(
    () => this.loadState() === 'ready' && this.rows().length > 0 && this.listed().length === 0,
  );

  /** The one live message on the page: loading, failure, or how many terms are listed. */
  protected readonly status = computed(() => {
    switch (this.loadState()) {
      case 'loading':
        return 'Loading the glossary…';
      case 'error':
        return 'The glossary could not be loaded.';
    }
    if (this.rows().length === 0) {
      return 'The glossary has no terms yet.';
    }

    const category = this.category();
    const search = this.settledSearch();
    const count = filterRows(this.rows(), category, searchKey(search)).length;

    return resultsStatus(count, category === ALL_CATEGORIES ? null : categoryLabel(category), search.trim());
  });

  constructor() {
    this.destroyRef.onDestroy(() => clearTimeout(this.settleTimer));
    this.load();

    effect(() => {
      const id = this.fragment();
      const ready = this.loadState() === 'ready';

      untracked(() => {
        if (!id) {
          this.unknownFragment.set(false);
        } else if (ready) {
          this.reveal(id);
        }
      });
    });
  }

  protected load(): void {
    this.loadState.set('loading');
    this.glossaryData
      .getTerms()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (terms) => {
          this.terms.set(terms);
          this.loadState.set('ready');
        },
        error: () => this.loadState.set('error'),
      });
  }

  protected updateSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;

    this.searchTerm.set(value);
    clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => this.settledSearch.set(value), STATUS_SETTLE_MS);
  }

  protected toggle(id: string): void {
    this.open.update((open) => ({ ...open, [id]: !open[id] }));
  }

  protected clearFilters(): void {
    this.resetFilters();
    this.afterRender(() => this.searchInput().nativeElement.focus());
  }

  /**
   * Brings what a link points at into view and moves focus to it, which the router's own scroll does not.
   * The target is a term (opened), a letter heading, or the A to Z nav; an id that is none of them shows a notice.
   * A filter that hides the target is cleared first.
   */
  protected reveal(id: string): void {
    const term = this.rows().find((row) => row.id === id);
    const isLetter = this.rows().some((row) => letterId(row.letter) === id);
    const known = term !== undefined || isLetter || id === LETTERS_ID;

    this.unknownFragment.set(!known);
    if (!known) {
      return;
    }

    const hidden = term ? !this.listed().includes(term) : isLetter && !this.groups().some((group) => group.id === id);

    if (hidden) {
      this.resetFilters();
    }
    if (term) {
      this.open.update((open) => ({ ...open, [id]: true }));
    }

    this.afterRender(() => {
      const target = term
        ? this.document.getElementById(term.buttonId)
        : id === LETTERS_ID
          ? this.document.querySelector<HTMLElement>(`#${LETTERS_ID} a`)
          : this.document.getElementById(id);

      target?.focus({ preventScroll: true });
      target?.scrollIntoView();
    });
  }

  private resetFilters(): void {
    clearTimeout(this.settleTimer);
    this.searchTerm.set('');
    this.settledSearch.set('');
    this.category.set(ALL_CATEGORIES);
  }

  private afterRender(callback: () => void): void {
    afterNextRender(callback, { injector: this.injector });
  }
}
