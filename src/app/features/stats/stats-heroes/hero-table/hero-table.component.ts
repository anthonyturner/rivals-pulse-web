import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { FilterSelectComponent } from '../../../../shared/components/filter-select/filter-select.component';
import { StatePanelComponent } from '../../../../shared/components/state-panel/state-panel.component';
import { HeroImageFallbackDirective } from '../../../../shared/directives/hero-image-fallback.directive';
import { HeroProgressListComponent } from '../../../insights/hero-progress-list/hero-progress-list.component';
import { selectHeroStatsRows, type HeroStatsSort, type WinRatesView } from './win-rates-view';

/**
 * Every hero's win rate and pick rate in a table, with a search, a role filter and a sort, and the
 * heroes still short of a rate beneath it. The half-season and mode are chosen by the tab, which
 * hands this the numbers for them.
 */
@Component({
  selector: 'app-hero-table',
  imports: [FilterSelectComponent, HeroImageFallbackDirective, HeroProgressListComponent, RouterLink, StatePanelComponent],
  templateUrl: './hero-table.component.html',
  styleUrl: './hero-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroTableComponent {
  readonly view = input.required<WinRatesView>();

  readonly search = signal('');
  readonly role = signal('');
  readonly sort = signal<HeroStatsSort>('win-desc');
  private readonly filtersChanged = signal(false);
  readonly sortChoices = [
    { value: 'win-desc', label: 'Win rate, highest first' },
    { value: 'win-asc', label: 'Win rate, lowest first' },
    { value: 'pick-desc', label: 'Pick rate, highest first' },
    { value: 'pick-asc', label: 'Pick rate, lowest first' },
  ] as const;
  readonly roleChoices = computed(() => [
    { value: '', label: 'All roles' },
    ...Array.from(
      new Set(
        [...this.view().ranked, ...this.view().building].map((row) => row.role).filter((role): role is string => !!role),
      ),
    )
      .sort()
      .map((role) => ({ value: role, label: role })),
  ]);
  readonly rows = computed(() => selectHeroStatsRows(this.view().ranked, this.search(), this.role(), this.sort()));
  readonly buildingRows = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();

    return this.view().building.filter(
      (row) => (!this.role() || row.role === this.role()) && row.name.toLocaleLowerCase().includes(query),
    );
  });
  readonly leaders = computed(() => ({
    win: selectHeroStatsRows(this.rows(), '', '', 'win-desc')[0] ?? null,
    pick: selectHeroStatsRows(this.rows(), '', '', 'pick-desc').find((row) => row.pickRate !== null) ?? null,
  }));
  readonly orderLabel = computed(() => this.sortChoices.find((choice) => choice.value === this.sort())?.label ?? '');
  readonly winSort = computed(() => (this.sort() === 'win-desc' ? 'descending' : this.sort() === 'win-asc' ? 'ascending' : 'none'));
  readonly pickSort = computed(() => (this.sort() === 'pick-desc' ? 'descending' : this.sort() === 'pick-asc' ? 'ascending' : 'none'));
  /** Spoken when the search, role or sort changes; empty until then, so the first draw needs no announcement. */
  readonly announcement = computed(() =>
    this.filtersChanged()
      ? `${this.rows().length} heroes with rates shown, ${this.orderLabel().toLocaleLowerCase()}; ${this.buildingRows().length} building sample. ${this.view().scopeLabel}.`
      : '',
  );

  searchHeroes(event: Event): void {
    if (event.target instanceof HTMLInputElement) {
      this.search.set(event.target.value);
      this.filtersChanged.set(true);
    }
  }

  chooseRole(value: string): void {
    this.role.set(value);
    this.filtersChanged.set(true);
  }

  chooseSort(value: string): void {
    if (value === 'win-desc' || value === 'win-asc' || value === 'pick-desc' || value === 'pick-asc') {
      this.sort.set(value);
      this.filtersChanged.set(true);
    }
  }

  sortColumn(column: 'win' | 'pick'): void {
    this.chooseSort(this.sort() === `${column}-desc` ? `${column}-asc` : `${column}-desc`);
  }

  resetFilters(): void {
    this.search.set('');
    this.role.set('');
    this.filtersChanged.set(true);
  }
}
